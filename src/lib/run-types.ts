import type { Branch, NodeKind, WorkflowGraph } from "./graph";

export type RunStatus = "queued" | "running" | "completed" | "failed";
export type StepStatus = "running" | "success" | "error";

/** One visit to one node. Index order == execution order. */
export interface StepRecord {
  index: number;
  nodeId: string;
  label: string;
  kind: NodeKind;
  prompt: string;
  status: StepStatus;
  answer?: Branch;
  /** Exactly what the model said, before parsing. */
  rawResponse?: string;
  source?: "openai" | "mock";
  model?: string;
  /** Inngest attempt number (1 = first try). Greater than 1 means a retry happened. */
  attempt: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  /** Node the run moved to next, null when the run ended here. */
  nextNodeId?: string | null;
  /** Edge that was followed to get there. */
  edgeId?: string | null;
}

export interface RunRecord {
  id: string;
  status: RunStatus;
  input: string;
  startNodeId: string;
  workflowName: string;
  /** Snapshot of the graph at the time of the run so history stays meaningful after edits. */
  graph: WorkflowGraph;
  steps: StepRecord[];
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** Set when this run was started via "retry from failed node". */
  retryOf?: string;
}

export interface RunSummary {
  id: string;
  status: RunStatus;
  workflowName: string;
  input: string;
  startedAt: string;
  finishedAt?: string;
  stepCount: number;
  path: string[];
  error?: string;
}

export const RUN_REQUESTED_EVENT = "workflow/run.requested";
