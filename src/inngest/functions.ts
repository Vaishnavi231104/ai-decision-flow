import { NonRetriableError } from "inngest";

import { inngest } from "./client";
import { findEdge, MAX_STEPS } from "@/lib/graph";
import { askYesNo } from "@/lib/llm";
import { getRun, updateRun, upsertStep } from "@/lib/run-store";
import { RUN_REQUESTED_EVENT, type StepRecord } from "@/lib/run-types";

/**
 * Executes a workflow graph.
 *
 * Every node visit is its own `step.run`, so Inngest durably records each
 * decision, retries only the node that failed, and never re-asks the LLM for a
 * node that already answered (step results are memoised across replays).
 *
 * The graph is traversed dynamically: the next step is chosen at runtime from
 * the YES/NO answer of the previous one.
 */
export const runWorkflow = inngest.createFunction(
  {
    id: "run-workflow",
    triggers: [{ event: RUN_REQUESTED_EVENT }],
    retries: 3,
    onFailure: async ({ event, error }) => {
      const original = event.data.event as { data?: { runId?: string } };
      const runId = original.data?.runId;
      if (!runId) return;
      await updateRun(runId, (run) => {
        run.status = "failed";
        run.error = error.message;
        run.finishedAt = new Date().toISOString();
        // Make sure no step is left spinning forever in the UI.
        for (const s of run.steps) {
          if (s.status === "running") {
            s.status = "error";
            s.error ??= error.message;
            s.finishedAt = run.finishedAt;
          }
        }
      });
    },
  },
  async ({ event, step, attempt }) => {
    const runId = (event.data as { runId: string }).runId;

    const run = await step.run("load-run", async () => {
      const r = await getRun(runId);
      if (!r) throw new NonRetriableError(`Run ${runId} not found`);
      await updateRun(runId, (rec) => {
        rec.status = "running";
      });
      return { startNodeId: r.startNodeId, input: r.input, graph: r.graph };
    });

    const nodes = new Map(run.graph.nodes.map((n) => [n.id, n]));
    const order: string[] = [];
    let current: string | null = run.startNodeId;
    let index = 0;

    while (current) {
      if (index >= MAX_STEPS) {
        throw new NonRetriableError(
          `Stopped after ${MAX_STEPS} steps. The workflow probably contains a cycle.`
        );
      }
      const node = nodes.get(current);
      if (!node) throw new NonRetriableError(`Node ${current} does not exist in the graph`);

      const stepIndex = index;
      // Unique, human-readable id per visit: shows up as-is in the Inngest dev UI.
      const result: { nextNodeId: string | null; answer: "yes" | "no" | null } = await step.run(
        `${String(stepIndex + 1).padStart(2, "0")}-${node.data.label || node.id}`,
        async () => {
          const startedAt = new Date().toISOString();
          const base: StepRecord = {
            index: stepIndex,
            nodeId: node.id,
            label: node.data.label || node.id,
            kind: node.type,
            prompt: node.data.prompt,
            status: "running",
            attempt: attempt + 1, // Inngest's `attempt` is zero-based; show 1 for the first try
            startedAt,
          };
          await upsertStep(runId, base);

          try {
            if (node.type === "decision" && !node.data.prompt.trim()) {
              throw new NonRetriableError(`Node "${base.label}" has an empty prompt`);
            }

            // Outcome nodes are terminal markers: they are a step, but make no LLM call.
            const decision = node.type === "decision" ? await askYesNo(node.data.prompt, run.input) : null;
            const edge = decision ? findEdge(run.graph, node.id, decision.answer) : undefined;
            const finishedAt = new Date().toISOString();

            await upsertStep(runId, {
              ...base,
              status: "success",
              answer: decision?.answer,
              rawResponse: decision?.rawResponse,
              source: decision?.source,
              model: decision?.model,
              finishedAt,
              durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
              nextNodeId: edge?.target ?? null,
              edgeId: edge?.id ?? null,
            });
            return { nextNodeId: edge?.target ?? null, answer: decision?.answer ?? null };
          } catch (err) {
            const finishedAt = new Date().toISOString();
            await upsertStep(runId, {
              ...base,
              status: "error",
              error: (err as Error).message,
              finishedAt,
              durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
            });
            throw err; // let Inngest retry (or give up for NonRetriableError)
          }
        }
      );

      order.push(node.id);
      current = result.nextNodeId;
      index++;
    }

    await step.run("finish-run", async () => {
      await updateRun(runId, (rec) => {
        rec.status = "completed";
        rec.finishedAt = new Date().toISOString();
      });
    });

    return { runId, path: order };
  }
);

export const functions = [runWorkflow];
