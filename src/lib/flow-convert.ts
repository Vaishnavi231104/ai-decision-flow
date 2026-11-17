import type { BranchFlowEdge } from "@/components/flow/branch-edge";
import type { WorkflowFlowNode } from "@/components/flow/workflow-node";
import { resolveStartNodeId, type WorkflowGraph } from "./graph";

/** Persisted graph -> React Flow elements. */
export function graphToFlow(graph: WorkflowGraph): { nodes: WorkflowFlowNode[]; edges: BranchFlowEdge[] } {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { label: n.data.label, prompt: n.data.prompt },
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.type,
      type: e.type,
      data: {},
    })),
  };
}

/** React Flow elements -> persisted graph (drops transient UI fields like selection and run state). */
export function flowToGraph(args: {
  name: string;
  startNodeId: string | null;
  nodes: WorkflowFlowNode[];
  edges: BranchFlowEdge[];
}): WorkflowGraph {
  const graph: WorkflowGraph = {
    version: 1,
    name: args.name.trim() || "Untitled workflow",
    startNodeId: args.startNodeId,
    nodes: args.nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "decision",
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: { label: n.data.label, prompt: n.data.prompt },
    })),
    edges: args.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type === "no" ? "no" : "yes",
    })),
  };
  graph.startNodeId = resolveStartNodeId(graph);
  return graph;
}
