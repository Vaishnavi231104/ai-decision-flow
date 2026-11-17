import { NextResponse } from "next/server";
import { z } from "zod";

import { inngest } from "@/inngest/client";
import { graphSchema, resolveStartNodeId, validateGraph } from "@/lib/graph";
import { createRun, updateRun } from "@/lib/run-store";
import { RUN_REQUESTED_EVENT, type RunRecord } from "@/lib/run-types";

export const runtime = "nodejs";

const bodySchema = z.object({
  graph: graphSchema,
  input: z.string().max(10_000).default(""),
  /** Start somewhere other than the graph's start node (used by "retry from failed node"). */
  startNodeId: z.string().optional(),
  retryOf: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const { graph, input, retryOf } = parsed.data;

  const errors = validateGraph(graph).filter((i) => i.level === "error");
  if (errors.length) {
    return NextResponse.json({ error: errors.map((e) => e.message).join(" ") }, { status: 422 });
  }

  const startNodeId =
    parsed.data.startNodeId && graph.nodes.some((n) => n.id === parsed.data.startNodeId)
      ? parsed.data.startNodeId
      : resolveStartNodeId(graph);
  if (!startNodeId) return NextResponse.json({ error: "No start node" }, { status: 422 });

  const id = `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const run: RunRecord = {
    id,
    status: "queued",
    input,
    startNodeId,
    workflowName: graph.name,
    graph,
    steps: [],
    startedAt: new Date().toISOString(),
    retryOf,
  };
  await createRun(run);

  try {
    await inngest.send({ name: RUN_REQUESTED_EVENT, data: { runId: id } });
  } catch (err) {
    const message =
      "Could not reach Inngest. Is the dev server running? Start it with `pnpm inngest` (or `pnpm dev:all`). " +
      `(${(err as Error).message})`;
    await updateRun(id, (r) => {
      r.status = "failed";
      r.error = message;
      r.finishedAt = new Date().toISOString();
    });
    return NextResponse.json({ error: message, runId: id }, { status: 503 });
  }

  return NextResponse.json({ runId: id });
}
