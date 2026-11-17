"use client";

import { useRef, useState } from "react";
import { Download, FilePlus2, FolderOpen, Save, Sparkles, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface SavedWorkflow {
  id: string;
  name: string;
  savedAt: string;
  nodeCount: number;
}

interface Props {
  name: string;
  onNameChange: (v: string) => void;
  saved: SavedWorkflow[];
  onSave: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  /** Returns an error message, or null on success. */
  onImport: (text: string) => string | null;
  onExample: () => void;
  onNew: () => void;
}

export function LibraryPanel({ name, onNameChange, saved, onSave, onLoad, onDelete, onExport, onImport, onExample, onNew }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const doImport = (text: string) => {
    const err = onImport(text);
    setImportError(err);
    if (!err) setPaste("");
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <Label htmlFor="wf-name">Workflow name</Label>
        <div className="flex gap-2">
          <Input id="wf-name" value={name} onChange={(e) => onNameChange(e.target.value)} />
          <Button onClick={onSave}>
            <Save /> Save
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Your canvas is auto-saved in this browser. Save adds a named copy you can load later.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Saved workflows</h3>
        {saved.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing saved yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-md border bg-card p-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {s.nodeCount} nodes · {new Date(s.savedAt).toLocaleString()}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onLoad(s.id)}>
                  <FolderOpen /> Load
                </Button>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => onDelete(s.id)} aria-label="Delete saved workflow">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">JSON</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> Import file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) doImport(await f.text());
              e.target.value = "";
            }}
          />
        </div>
        <Textarea
          rows={4}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="…or paste workflow JSON here"
          className="font-mono text-xs"
        />
        <Button size="sm" variant="secondary" disabled={!paste.trim()} onClick={() => doImport(paste)}>
          Import pasted JSON
        </Button>
        {importError && <p className="text-xs text-destructive">{importError}</p>}
      </section>

      <section className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onExample}>
          <Sparkles /> Load example
        </Button>
        <Button size="sm" variant="outline" onClick={onNew}>
          <FilePlus2 /> New blank
        </Button>
      </section>
    </div>
  );
}
