import type { Branch } from "./graph";
import type { RunRecord } from "./run-types";

export type NodeVisualState = "idle" | "running" | "success" | "error" | "skipped";
export type EdgeVisualState = "idle" | "taken" | "active";

export interface NodeRunView {
  state: NodeVisualState;
  answer?: Branch;
  /** 1-based execution order(s); a node in a cycle can be visited more than once. */
  order: number[];
  attempt?: number;
  error?: string;
}

export interface RunView {
  nodes: Record<string, NodeRunView>;
  edges: Record<string, EdgeVisualState>;
}

/**
 * Turns a run record into per-node / per-edge visual state.
 * Pure function: the canvas just renders whatever this returns.
 */
export function deriveRunView(run: RunRecord | null): RunView {
  const view: RunView = { nodes: {}, edges: {} };
  if (!run) return view;

  const finished = run.status === "completed" || run.status === "failed";

  for (const step of run.steps) {
    const prev = view.nodes[step.nodeId];
    view.nodes[step.nodeId] = {
      state: step.status === "running" ? "running" : step.status,
      answer: step.answer,
      order: [...(prev?.order ?? []), step.index + 1],
      attempt: step.attempt,
      error: step.error,
    };
    if (step.edgeId) view.edges[step.edgeId] = "taken";
  }

  const last = run.steps[run.steps.length - 1];
  if (!finished) {
    // While executing, animate the edge that leads into the node being processed,
    // and mark the start node as running before the first step is recorded.
    if (last?.status === "running") {
      const prev = run.steps[run.steps.length - 2];
      if (prev?.edgeId) view.edges[prev.edgeId] = "active";
    } else if (last?.status === "success" && last.edgeId) {
      view.edges[last.edgeId] = "active"; // answer is in, next node is about to start
    } else if (!last) {
      view.nodes[run.startNodeId] = { state: "running", order: [] };
    }
  } else {
    for (const n of run.graph.nodes) {
      if (!view.nodes[n.id]) view.nodes[n.id] = { state: "skipped", order: [] };
    }
  }

  return view;
}
