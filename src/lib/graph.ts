import { z } from "zod";

/**
 * Shared graph model. Used by the React Flow editor (client), the run API
 * (server) and the Inngest function, so there is a single source of truth for
 * what a workflow looks like and how it is traversed.
 */

export const branchSchema = z.enum(["yes", "no"]);
export type Branch = z.infer<typeof branchSchema>;

export const nodeKindSchema = z.enum(["decision", "outcome"]);
export type NodeKind = z.infer<typeof nodeKindSchema>;

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  type: nodeKindSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string(),
    prompt: z.string(),
  }),
});

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  /** The edge type *is* the branch: a YES edge or a NO edge. */
  type: branchSchema,
});

export const graphSchema = z.object({
  version: z.literal(1).default(1),
  name: z.string().default("Untitled workflow"),
  startNodeId: z.string().nullable().default(null),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type GraphNode = z.output<typeof graphNodeSchema>;
export type GraphEdge = z.output<typeof graphEdgeSchema>;
export type WorkflowGraph = z.output<typeof graphSchema>;

/** Hard stop so a cyclic graph can never run forever. */
export const MAX_STEPS = 25;

export function uid(prefix = "n") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/** The node execution begins at: explicit start, else first node without incoming edges. */
export function resolveStartNodeId(graph: WorkflowGraph): string | null {
  if (graph.startNodeId && graph.nodes.some((n) => n.id === graph.startNodeId)) {
    return graph.startNodeId;
  }
  const targets = new Set(graph.edges.map((e) => e.target));
  const root = graph.nodes.find((n) => !targets.has(n.id));
  return (root ?? graph.nodes[0])?.id ?? null;
}

export function findEdge(graph: WorkflowGraph, nodeId: string, branch: Branch): GraphEdge | undefined {
  return graph.edges.find((e) => e.source === nodeId && e.type === branch);
}

export type IssueLevel = "error" | "warning";
export interface GraphIssue {
  level: IssueLevel;
  message: string;
  nodeId?: string;
}

/** Static checks. `error` issues block a run; `warning` issues are advisory. */
export function validateGraph(graph: WorkflowGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  if (graph.nodes.length === 0) {
    issues.push({ level: "error", message: "Add at least one node." });
    return issues;
  }

  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const e of graph.edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) {
      issues.push({ level: "error", message: `Edge ${e.id} points to a node that does not exist.` });
    }
  }

  for (const n of graph.nodes) {
    if (n.type === "decision" && !n.data.prompt.trim()) {
      issues.push({ level: "error", message: `"${n.data.label || n.id}" has an empty prompt.`, nodeId: n.id });
    }
  }

  const start = resolveStartNodeId(graph);
  if (start) {
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of graph.edges) {
        if (e.source === cur && !seen.has(e.target)) {
          seen.add(e.target);
          queue.push(e.target);
        }
      }
    }
    for (const n of graph.nodes) {
      if (!seen.has(n.id)) {
        issues.push({
          level: "warning",
          message: `"${n.data.label || n.id}" is not reachable from the start node.`,
          nodeId: n.id,
        });
      }
    }
  }

  for (const n of graph.nodes) {
    if (n.type !== "decision") continue;
    const missing = (["yes", "no"] as const).filter((b) => !findEdge(graph, n.id, b));
    if (missing.length === 2) {
      issues.push({
        level: "warning",
        message: `"${n.data.label || n.id}" has no outgoing edges; the run ends here.`,
        nodeId: n.id,
      });
    } else if (missing.length === 1) {
      issues.push({
        level: "warning",
        message: `"${n.data.label || n.id}" has no ${missing[0].toUpperCase()} edge; the run ends if the answer is ${missing[0].toUpperCase()}.`,
        nodeId: n.id,
      });
    }
  }

  return issues;
}

export function parseGraph(input: unknown): WorkflowGraph {
  return graphSchema.parse(input);
}

/** A ready-made workflow that mirrors the assignment's support/sales example. */
export function exampleGraph(): WorkflowGraph {
  return {
    version: 1,
    name: "Support / Sales triage",
    startNodeId: "start",
    nodes: [
      {
        id: "start",
        type: "decision",
        position: { x: 380, y: 0 },
        data: { label: "Support request?", prompt: "Is this a support request (a problem, bug, or a question about how to use a product)?" },
      },
      {
        id: "support",
        type: "decision",
        position: { x: 100, y: 230 },
        data: { label: "Support Node: urgent?", prompt: "Is the customer reporting an outage, data loss, or something blocking them completely?" },
      },
      {
        id: "sales",
        type: "decision",
        position: { x: 660, y: 230 },
        data: { label: "Sales Node: buying?", prompt: "Is the sender interested in pricing, plans, a demo, or purchasing?" },
      },
      {
        id: "escalate",
        type: "outcome",
        position: { x: -60, y: 470 },
        data: { label: "Escalate to on-call", prompt: "" },
      },
      {
        id: "queue",
        type: "outcome",
        position: { x: 250, y: 470 },
        data: { label: "Standard support queue", prompt: "" },
      },
      {
        id: "sales-team",
        type: "outcome",
        position: { x: 520, y: 470 },
        data: { label: "Route to sales team", prompt: "" },
      },
      {
        id: "general",
        type: "outcome",
        position: { x: 830, y: 470 },
        data: { label: "General inbox", prompt: "" },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "support", type: "yes" },
      { id: "e2", source: "start", target: "sales", type: "no" },
      { id: "e3", source: "support", target: "escalate", type: "yes" },
      { id: "e4", source: "support", target: "queue", type: "no" },
      { id: "e5", source: "sales", target: "sales-team", type: "yes" },
      { id: "e6", source: "sales", target: "general", type: "no" },
    ],
  };
}
