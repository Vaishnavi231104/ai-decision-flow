"use client";

import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RunSummary } from "@/lib/run-types";
import { cn } from "@/lib/utils";

interface Props {
  runs: RunSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ runs, activeId, onSelect, onClear }: Props) {
  if (runs.length === 0) {
    return <p className="text-xs text-muted-foreground">No runs yet. Completed runs are listed here.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{runs.length} recent run(s)</span>
        <Button size="sm" variant="ghost" onClick={onClear}>
          <Trash2 /> Clear
        </Button>
      </div>
      <ul className="space-y-1.5">
        {runs.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              className={cn(
                "w-full rounded-md border bg-card p-2.5 text-left text-xs hover:bg-accent",
                activeId === r.id && "border-primary ring-1 ring-primary/40"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{r.workflowName}</span>
                <Badge
                  variant={r.status === "completed" ? "yes" : r.status === "failed" ? "destructive" : "secondary"}
                  className="capitalize"
                >
                  {r.status}
                </Badge>
              </div>
              <div className="mt-1 truncate text-muted-foreground">&ldquo;{r.input || "(empty input)"}&rdquo;</div>
              <div className="mt-1 truncate text-[11px] text-muted-foreground">
                {r.path.length ? r.path.join(" → ") : "no steps"}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{new Date(r.startedAt).toLocaleString()}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
