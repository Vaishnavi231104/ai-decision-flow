import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { RunRecord, RunSummary, StepRecord } from "./run-types";

/**
 * Tiny file-backed run store.
 *
 * Inngest executes the workflow in the background, so the browser needs a
 * shared place to read progress from. A JSON file per run under `.data/runs`
 * is enough for local development and survives dev-server restarts. Swap this
 * module for Redis/Postgres in production; the API is deliberately small.
 */

const DIR = process.env.RUN_STORE_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "runs");

// Serialise writes per run so concurrent updates never interleave.
const queues = new Map<string, Promise<unknown>>();

function file(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid run id");
  return path.join(DIR, `${id}.json`);
}

async function write(run: RunRecord) {
  await fs.mkdir(DIR, { recursive: true });
  const target = file(run.id);
  const tmp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(run, null, 2), "utf8");
  await fs.rename(tmp, target);
}

export async function getRun(id: string): Promise<RunRecord | null> {
  try {
    return JSON.parse(await fs.readFile(file(id), "utf8")) as RunRecord;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export function createRun(run: RunRecord): Promise<void> {
  return write(run);
}

/** Atomically read-modify-write a run. Updates for the same run are serialised. */
export function updateRun(id: string, mutate: (run: RunRecord) => void): Promise<RunRecord | null> {
  const prev = queues.get(id) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      const run = await getRun(id);
      if (!run) return null;
      mutate(run);
      await write(run);
      return run;
    });
  queues.set(id, next);
  return next;
}

/** Insert or replace the step at `index` (idempotent, which Inngest replays require). */
export function upsertStep(id: string, step: StepRecord) {
  return updateRun(id, (run) => {
    const existing = run.steps.findIndex((s) => s.index === step.index);
    if (existing >= 0) run.steps[existing] = step;
    else run.steps.push(step);
    run.steps.sort((a, b) => a.index - b.index);
  });
}

export async function listRuns(limit = 30): Promise<RunSummary[]> {
  let names: string[];
  try {
    names = await fs.readdir(DIR);
  } catch {
    return [];
  }
  const runs: RunRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      runs.push(JSON.parse(await fs.readFile(path.join(DIR, name), "utf8")) as RunRecord);
    } catch {
      // A file mid-write or corrupted: skip it rather than failing the whole listing.
    }
  }
  return runs
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      status: r.status,
      workflowName: r.workflowName,
      input: r.input,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      stepCount: r.steps.length,
      path: r.steps.map((s) => s.label),
      error: r.error,
    }));
}

export async function deleteAllRuns() {
  await fs.rm(DIR, { recursive: true, force: true });
}
