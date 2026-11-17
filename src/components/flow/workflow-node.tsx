"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { BrainCircuit, CheckCircle2, Flag, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NodeKind } from "@/lib/graph";
import type { NodeRunView } from "@/lib/run-view";

export type WorkflowNodeData = {
  label: string;
  prompt: string;
  isStart?: boolean;
  run?: NodeRunView;
};
export type WorkflowFlowNode = Node<WorkflowNodeData, NodeKind>;

const STATE_RING: Record<string, string> = {
  idle: "border-border",
  running: "border-primary node-running",
  success: "border-yes/70",
  error: "border-destructive",
  skipped: "border-border opacity-45",
};

function WorkflowNodeImpl({ data, selected, type }: NodeProps<WorkflowFlowNode>) {
  const run = data.run;
  const state = run?.state ?? "idle";
  const isOutcome = type === "outcome";

  return (
    <div
      className={cn(
        "w-[230px] rounded-xl border-2 bg-card shadow-sm transition-all",
        STATE_RING[state],
        selected && "ring-2 ring-ring ring-offset-1"
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-3 !border-2 !border-card !bg-muted-foreground" />

      <div className="flex items-start gap-2 px-3 pt-2.5">
        <div
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
            isOutcome ? "bg-yes/15 text-yes" : "bg-primary/10 text-primary"
          )}
        >
          {isOutcome ? <Flag className="size-3.5" /> : <BrainCircuit className="size-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm leading-tight font-semibold">{data.label || "Untitled"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {data.isStart && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">START</Badge>}
            {isOutcome && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">OUTCOME</Badge>}
            {run && run.order.length > 0 && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">#{run.order.join(", #")}</Badge>
            )}
            {(run?.attempt ?? 0) > 1 && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">try {run?.attempt}</Badge>
            )}
          </div>
        </div>
        <div className="mt-0.5 shrink-0">
          {state === "running" && <Loader2 className="size-4 animate-spin text-primary" />}
          {state === "success" && !isOutcome && run?.answer && (
            <Badge variant={run.answer}>{run.answer.toUpperCase()}</Badge>
          )}
          {state === "success" && isOutcome && <CheckCircle2 className="size-4 text-yes" />}
          {state === "error" && <XCircle className="size-4 text-destructive" />}
        </div>
      </div>

      {!isOutcome && (
        <p className="line-clamp-3 px-3 pt-1.5 text-xs text-muted-foreground">
          {data.prompt || <span className="italic">No prompt yet. Select the node to write one.</span>}
        </p>
      )}
      {state === "error" && run?.error && (
        <p className="line-clamp-2 px-3 pt-1.5 text-[11px] text-destructive">{run.error}</p>
      )}

      {isOutcome ? (
        <div className="h-2.5" />
      ) : (
        <div className="relative mt-2 flex h-6 items-end justify-between px-6 pb-1 text-[10px] font-bold tracking-wide">
          <span className="text-yes">YES</span>
          <span className="text-no">NO</span>
          <Handle
            id="yes"
            type="source"
            position={Position.Bottom}
            style={{ left: "25%" }}
            className="!size-3 !border-2 !border-card !bg-yes"
          />
          <Handle
            id="no"
            type="source"
            position={Position.Bottom}
            style={{ left: "75%" }}
            className="!size-3 !border-2 !border-card !bg-no"
          />
        </div>
      )}
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeImpl);
