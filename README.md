# AI Decision Flow

A visual workflow builder where every node is an **AI decision step that answers `YES` or `NO`**.
You draw the flow with [React Flow](https://reactflow.dev), and the run is executed durably by
[Inngest](https://www.inngest.com): one Inngest step per node, an LLM call per step, and the answer
picks which edge to follow next.

```
 "Is this a support request?"
      │YES                     │NO
      ▼                        ▼
 Support Node             Sales Node
```

## Stack

| Concern        | Choice                                   |
| -------------- | ---------------------------------------- |
| App            | Next.js (App Router) + TypeScript        |
| Canvas         | `@xyflow/react` (React Flow)             |
| Execution      | `inngest` (Next.js serve handler)        |
| LLM            | `openai` SDK (any chat model)            |
| UI             | Tailwind CSS v4 + shadcn/ui components   |
| Validation     | `zod` (shared by client and server)      |

## Quick start

Requires Node 20+. Examples use pnpm; npm/yarn work too.

```bash
pnpm install
cp .env.example .env.local     # then add OPENAI_API_KEY (optional, see below)
pnpm dev:all                   # Next.js on :3000 + Inngest dev server on :8288
```

Open <http://localhost:3000>. The header shows two status pills: which LLM is active and whether the
Inngest dev server is connected. The Inngest dev UI is at <http://localhost:8288> (runs, steps, retries).

Prefer two terminals? `pnpm dev` and `pnpm inngest`.

### Environment variables

| Variable             | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `OPENAI_API_KEY`     | Enables real LLM calls. **Leave empty to use mock mode** (see below).   |
| `OPENAI_MODEL`       | Chat model to use. Default `gpt-4o-mini`.                               |
| `OPENAI_BASE_URL`    | Optional. Point the OpenAI SDK at an OpenAI-compatible provider, e.g. Groq (`https://api.groq.com/openai/v1`). |
| `INNGEST_DEV`        | `1` forces the SDK to talk to the local dev server.                     |
| `INNGEST_BASE_URL`   | Dev server URL used for the health indicator. Default `http://127.0.0.1:8288`. |
| `RUN_STORE_DIR`      | Where run records are written. Default `./.data/runs`.                  |

**Free provider (Groq).** No OpenAI credits? Create a free key at <https://console.groq.com/keys> and set
`OPENAI_API_KEY=gsk_...`, `OPENAI_BASE_URL=https://api.groq.com/openai/v1`, `OPENAI_MODEL=openai/gpt-oss-20b`.
The code still uses the OpenAI SDK; only the endpoint changes.

**Mock mode.** With no `OPENAI_API_KEY`, nodes are answered by a small deterministic keyword matcher
so the whole pipeline (Inngest steps, branching, logs, retries) can be demoed offline. It is clearly
labelled in the UI ("Mock LLM") and in every log line (`via mock`). It is *not* an AI; set a real key
to get real decisions.

## How to use it

1. **Edit tab**: add *Decision* / *Outcome* nodes, drag from a node's green **YES** or red **NO**
   handle to another node, click a node to edit its title and prompt. Set which node is the start.
2. **Run tab**: enter the workflow input (for example a customer message) and press **Run workflow**.
   Nodes light up as they execute; the edge being traversed animates.
3. **Logs / History tabs**: per-step log with raw model output, timings, attempts; past runs can be reopened.
4. **Library tab**: save/load named workflows, export/import JSON, load the example.

## Architecture

```
Browser (React Flow)                        Next.js route handlers                Inngest
─────────────────────                       ──────────────────────                ───────
POST /api/run  {graph, input} ───────────▶  validate graph, create run record
                                            inngest.send("workflow/run.requested") ─▶ run-workflow function
                                                                                      │ step.run("01-Support request?")
GET /api/runs/:id  (poll every 500 ms) ◀──  run record (.data/runs/*.json) ◀──────────┤   └─ askYesNo() → LLM
 └─ node + edge visual state                                                          │ step.run("02-Support Node…")
                                                                                      │ …until a node has no matching edge
```

- **`src/lib/graph.ts`**: the graph schema, validation and traversal helpers shared by client and server.
- **`src/inngest/functions.ts`**: the executor. A `while` loop visits nodes; each visit is its own
  `step.run`, and the next node is chosen at runtime from the previous answer (`findEdge(graph, node, "yes" | "no")`).
  Because step results are memoised, a retry or replay never re-asks the LLM about a node that already answered.
  A step cap (`MAX_STEPS = 25`) stops cyclic graphs.
- **`src/lib/llm.ts`**: sends the node prompt plus the workflow input to the model with a system prompt that
  demands exactly `YES` or `NO`. The reply is parsed strictly; anything else throws and Inngest retries the step.
  Auth/bad-request errors (400/401/403/404) are `NonRetriableError`s so they fail fast instead of burning retries.
- **`src/lib/run-store.ts`**: a tiny file-backed store the Inngest function writes progress into and the UI polls.
- **Edge types**: React Flow edge types `yes` and `no` (`src/components/flow/branch-edge.tsx`). The edge type *is* the
  branch the executor follows. A handle can have only one outgoing edge; connecting again replaces it.

Node types: **Decision** (asks the LLM) and **Outcome** (terminal marker, no LLM call, still its own Inngest step).
A decision with no edge for the chosen answer simply ends the run there.

## Assignment checklist

**Phase 1 – Setup**: Next.js + React Flow + Inngest + OpenAI SDK + shadcn/ui, `.env` files, structured project, README.

**Phase 2 – Foundations**: React Flow canvas; add, connect and delete nodes; editable prompts; `yes`/`no` edge types;
graph state persisted in `localStorage`.

**Phase 3 – Core**: one Inngest step per node; prompt sent to an LLM; strict YES/NO; dynamic traversal along the chosen
edge; execution order tracked (`#1, #2…` badges on nodes, ordered timeline, ordered log).

**Phase 4 – Polish** (more than the required three):
- Visual execution state: running / success / error / skipped styling on nodes, YES/NO answer badges
- Animated active edges, highlighted taken path
- Execution logs panel (raw model output, durations, attempts, copyable)
- Execution history (past runs, reopen onto the canvas)
- Save/load named workflows and JSON export/import (zod-validated)
- Error handling: strict output validation, `NonRetriableError` for auth errors, `onFailure` handler, graph validation
  with readable messages, Inngest-offline detection
- Retry: automatic (Inngest, 3 retries per step) and manual **Retry from failed node**

## Scripts

| Script           | What it does                                   |
| ---------------- | ---------------------------------------------- |
| `pnpm dev`       | Next.js dev server                             |
| `pnpm inngest`   | Inngest dev server pointed at `/api/inngest`   |
| `pnpm dev:all`   | Both of the above together                     |
| `pnpm build`     | Production build                               |
| `pnpm typecheck` | `tsc --noEmit`                                 |

## Known limitations

- Run history lives in local JSON files, which is fine for local development but not for serverless hosting
  (read-only/ephemeral disk). Swap `run-store.ts` for a database for production.
- The UI polls for progress instead of streaming.
- Retry-from-node starts a fresh run at that node with the same input; it does not restore earlier steps.
- Only the OpenAI provider is implemented; `askYesNo` is the single place to add another.
