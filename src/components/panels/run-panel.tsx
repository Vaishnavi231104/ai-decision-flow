"use client";

import { AlertTriangle, CheckCircle2, Loader2, Play, RotateCcw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GraphIssue } from "@/lib/graph";
import type { RunRecord } from "@/lib/run-types";
import { cn } from "@/lib/utils";

const SAMPLES = [
  "My dashboard keeps crashing whenever I upload a CSV, and my whole team is blocked.",
  "Hi! How much would the Pro plan cost for 20 seats? We'd like a demo too.",
  "Just wanted to say thanks for the great newsletter.",
];

interface Props {
  input: string;
  onInputChange: (v: string) => void;
  onRun: () => void;
  onRetryFrom: (nodeId: string) => void;
  starting: boolean;
  run: RunRecord | null;
  issues: GraphIssue[];
  error: string | null;
}

export function RunPanel({ input, onInputChange, onRun, onRetryFrom, starting, run, issues, error }: Props) {
  const running = run?.status === "queued" || run?.status === "running";
  const blocking = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const failedStep = run?.steps.find((s) => s.status === "error");
  const waitingLong = run?.status === "queued" && Date.now() - Date.parse(run.startedAt) > 8000;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="run-input">Workflow input</Label>
        <Textarea
          id="run-input"
          rows={4}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Text the workflow should reason about, e.g. a customer message"
        />
        <div className="flex flex-wrap gap-1.5">
          {SAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onInputChange(s)}
              className="max-w-full truncate rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
              title={s}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Button className="w-full" onClick={onRun} disabled={starting || running || blocking.length > 0}>
        {starting || running ? <Loader2 className="animate-spin" /> : <Play />}
        {running ? "Running…" : "Run workflow"}
      </Button>

      {blocking.length > 0 && (
        <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
          {blocking.map((i, k) => (
            <li key={k} className="flex gap-1.5">
              <XCircle className="mt-0.5 size-3.5 shrink-0" /> {i.message}
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && !run && (
        <ul className="space-y-1 rounded-md border bg-muted p-2.5 text-xs text-muted-foreground">
          {warnings.map((i, k) => (
            <li key={k} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {i.message}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">{error}</div>
      )}

      {waitingLong && (
        <div className="rounded-md border bg-muted p-2.5 text-xs text-muted-foreground">
          Inngest hasn&apos;t picked this run up yet. Make sure the dev server is running (<code>pnpm inngest</code>) and
          has synced the app at <code>/api/inngest</code>.
        </div>
      )}

      {run && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Execution</h3>
            <Badge
              variant={run.status === "completed" ? "yes" : run.status === "failed" ? "destructive" : "secondary"}
              className="capitalize"
            >
              {running && <Loader2 className="animate-spin" />}
              {run.status}
            </Badge>
          </div>

          <ol className="space-y-1.5">
            {run.steps.map((s) => (
              <li
                key={s.index}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs",
                  s.status === "error" && "border-destructive/40"
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                  {s.index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                {s.attempt > 1 && <Badge variant="outline">try {s.attempt}</Badge>}
                {s.status === "running" && <Loader2 className="size-3.5 animate-spin text-primary" />}
                {s.status === "success" && s.answer && <Badge variant={s.answer}>{s.answer.toUpperCase()}</Badge>}
                {s.status === "success" && !s.answer && <CheckCircle2 className="size-4 text-yes" />}
                {s.status === "error" && <XCircle className="size-4 text-destructive" />}
              </li>
            ))}
          </ol>

          {run.status === "completed" && (
            <div className="rounded-md border border-yes/30 bg-yes/5 p-2.5 text-xs">
              <b>Finished at:</b> {run.steps[run.steps.length - 1]?.label ?? "(nothing ran)"}
            </div>
          )}

          {run.status === "failed" && (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
              <div className="text-destructive">{run.error ?? failedStep?.error ?? "Run failed"}</div>
              {failedStep && (
                <Button size="sm" variant="outline" onClick={() => onRetryFrom(failedStep.nodeId)} disabled={starting}>
                  <RotateCcw /> Retry from &ldquo;{failedStep.label}&rdquo;
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
