"use client";

import { Flag, Play, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BranchFlowEdge } from "@/components/flow/branch-edge";
import type { WorkflowFlowNode } from "@/components/flow/workflow-node";
import type { NodeRunView } from "@/lib/run-view";

interface Props {
  node: WorkflowFlowNode | null;
  edge: BranchFlowEdge | null;
  isStart: boolean;
  nodeRun?: NodeRunView;
  onChange: (id: string, patch: { label?: string; prompt?: string }) => void;
  onSetStart: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
}

export function InspectorPanel({ node, edge, isStart, nodeRun, onChange, onSetStart, onDeleteNode, onDeleteEdge }: Props) {
  if (edge) {
    const yes = edge.type !== "no";
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Edge</h3>
          <Badge variant={yes ? "yes" : "no"}>{yes ? "YES path" : "NO path"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Followed when the source node answers {yes ? "YES" : "NO"}. To change the branch, delete this edge and drag
          from the other handle.
        </p>
        <Button variant="outline" size="sm" onClick={() => onDeleteEdge(edge.id)}>
          <Trash2 /> Delete edge
        </Button>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="space-y-4 text-sm">
        <div>
          <h3 className="font-semibold">Build your flow</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Each <b>decision node</b> asks the AI a question and gets back <b>YES</b> or <b>NO</b>. The answer picks the
            edge to follow.
          </p>
        </div>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
          <li>Add nodes with the toolbar above the canvas.</li>
          <li>
            Drag from a node&apos;s <span className="font-semibold text-yes">YES</span> or{" "}
            <span className="font-semibold text-no">NO</span> handle to another node.
          </li>
          <li>Click a node to edit its prompt here.</li>
          <li>Open the Run tab, type an input and press Run.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Tip: <kbd className="rounded border bg-muted px-1">Backspace</kbd> deletes the selected node or edge.
        </p>
      </div>
    );
  }

  const isOutcome = node.type === "outcome";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{isOutcome ? "Outcome node" : "Decision node"}</h3>
        {isStart && <Badge variant="secondary">START</Badge>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="node-label">Title</Label>
        <Input
          id="node-label"
          value={node.data.label}
          onChange={(e) => onChange(node.id, { label: e.target.value })}
          placeholder="e.g. Is this a support request?"
        />
      </div>

      {isOutcome ? (
        <p className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground">
          Outcome nodes end a branch. They make no AI call; reaching one records the result of the run.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="node-prompt">Prompt (must be answerable with YES or NO)</Label>
          <Textarea
            id="node-prompt"
            rows={6}
            value={node.data.prompt}
            onChange={(e) => onChange(node.id, { prompt: e.target.value })}
            placeholder="Is this a support request?"
          />
          <p className="text-[11px] text-muted-foreground">
            The workflow input is sent along with this question. The model is instructed to reply with only YES or NO.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!isStart && (
          <Button variant="outline" size="sm" onClick={() => onSetStart(node.id)}>
            <Play /> Set as start
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => onDeleteNode(node.id)} className="text-destructive">
          <Trash2 /> Delete
        </Button>
      </div>

      {nodeRun && nodeRun.state !== "idle" && nodeRun.state !== "skipped" && (
        <div className="rounded-md border p-2.5 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <Flag className="size-3.5" /> Last run
          </div>
          <div className="text-muted-foreground">
            State: <b className="text-foreground">{nodeRun.state}</b>
            {nodeRun.answer && (
              <>
                {" "}
                · Answer: <b className={nodeRun.answer === "yes" ? "text-yes" : "text-no"}>{nodeRun.answer.toUpperCase()}</b>
              </>
            )}
          </div>
          {nodeRun.error && <div className="mt-1 text-destructive">{nodeRun.error}</div>}
        </div>
      )}
    </div>
  );
}
