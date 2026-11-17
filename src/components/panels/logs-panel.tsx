"use client";

import { useEffect, useMemo, useRef } from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RunRecord } from "@/lib/run-types";
import { cn } from "@/lib/utils";

type Level = "info" | "ok" | "err" | "dim";
interface Line {
  at: string;
  level: Level;
  text: string;
}

const LEVEL_CLASS: Record<Level, string> = {
  info: "text-foreground",
  ok: "text-yes",
  err: "text-destructive",
  dim: "text-muted-foreground",
};

function clock(iso?: string) {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  return `${d.toLocaleTimeString([], { hour12: false })}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

export function buildLogLines(run: RunRecord): Line[] {
  const lines: Line[] = [
    { at: run.startedAt, level: "info", text: `Run ${run.id} started${run.retryOf ? ` (retry of ${run.retryOf})` : ""}` },
    { at: run.startedAt, level: "dim", text: `input: ${JSON.stringify(run.input.slice(0, 200))}` },
  ];
  for (const s of run.steps) {
    lines.push({
      at: s.startedAt,
      level: "info",
      text: `#${s.index + 1} ${s.label} (${s.kind}) started${s.attempt > 1 ? `, attempt ${s.attempt}` : ""}`,
    });
    if (s.status === "success") {
      if (s.answer) {
        lines.push({
          at: s.finishedAt ?? s.startedAt,
          level: "ok",
          text: `  answer ${s.answer.toUpperCase()} in ${s.durationMs}ms via ${s.source}${s.model ? ` (${s.model})` : ""}; raw=${JSON.stringify(s.rawResponse)}`,
        });
      }
      lines.push({
        at: s.finishedAt ?? s.startedAt,
        level: "dim",
        text: s.nextNodeId ? `  -> next: ${run.graph.nodes.find((n) => n.id === s.nextNodeId)?.data.label ?? s.nextNodeId}` : "  -> end of path",
      });
    } else if (s.status === "error") {
      lines.push({ at: s.finishedAt ?? s.startedAt, level: "err", text: `  error after ${s.durationMs ?? 0}ms: ${s.error}` });
    }
  }
  if (run.status === "completed") lines.push({ at: run.finishedAt ?? "", level: "ok", text: `Run completed in ${run.steps.length} step(s)` });
  if (run.status === "failed") lines.push({ at: run.finishedAt ?? "", level: "err", text: `Run failed: ${run.error ?? "unknown error"}` });
  return lines;
}

export function LogsPanel({ run }: { run: RunRecord | null }) {
  const lines = useMemo(() => (run ? buildLogLines(run) : []), [run]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  if (!run) {
    return <p className="text-xs text-muted-foreground">Run a workflow to see its execution log here.</p>;
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigator.clipboard?.writeText(lines.map((l) => `[${clock(l.at)}] ${l.text}`).join("\n"))}
        >
          <Copy /> Copy
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} className={cn("break-words whitespace-pre-wrap", LEVEL_CLASS[l.level])}>
            <span className="text-muted-foreground">[{clock(l.at)}]</span> {l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
