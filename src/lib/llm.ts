import "server-only";
import OpenAI from "openai";
import { NonRetriableError } from "inngest";

import type { Branch } from "./graph";

export interface DecisionResult {
  answer: Branch;
  rawResponse: string;
  source: "openai" | "mock";
  model: string;
}

const SYSTEM_PROMPT = [
  "You are a decision node inside an automated workflow.",
  "You are given an INPUT and a QUESTION about it.",
  "Reply with exactly one word: YES or NO.",
  "Do not explain. Do not add punctuation or any other text.",
].join(" ");

export function llmConfig() {
  return {
    hasKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

/** Accepts "YES", "yes.", " No\n" ... but nothing that isn't clearly one of the two. */
export function parseYesNo(raw: string): Branch | null {
  const cleaned = raw.trim().replace(/^["'`*\s]+|["'`*.!\s]+$/g, "").toUpperCase();
  if (cleaned === "YES") return "yes";
  if (cleaned === "NO") return "no";
  return null;
}

let client: OpenAI | null = null;
function getClient() {
  // OPENAI_BASE_URL lets the OpenAI SDK talk to any OpenAI-compatible provider (Groq, OpenRouter, ...).
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  return client;
}

const STOPWORDS = new Set(
  "a an the is are was were be been this that these those of to in on for with and or it its any does do did has have had from by about as at into than then there their they you your we our can could should would will just not no yes".split(" ")
);

/**
 * Deterministic stand-in used when OPENAI_API_KEY is not set so the whole
 * pipeline can be demoed offline. It answers YES when a meaningful word from
 * the question appears in the input. The UI and logs label it clearly.
 */
// Tiny topic lexicon so the mock behaves sensibly on the bundled example.
const TOPICS: string[][] = [
  ["support", "problem", "bug", "issue", "crash", "error", "broken", "help", "fail", "blocked", "outage", "question"],
  ["urgent", "outage", "blocked", "crash", "down", "data loss", "critical", "asap"],
  ["pricing", "price", "cost", "plan", "demo", "buy", "purchase", "quote", "seats", "subscription"],
];

function mockDecision(prompt: string, input: string): DecisionResult {
  const lowerPrompt = prompt.toLowerCase();
  const words = lowerPrompt
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const haystack = input.toLowerCase();
  const expanded = new Set(words);
  for (const topic of TOPICS) {
    if (topic.some((t) => lowerPrompt.includes(t))) topic.forEach((t) => expanded.add(t));
  }
  const stems = [...expanded].map((w) => w.replace(/(ing|ed|es|s)$/, ""));
  const hit = stems.some((s) => s.length > 2 && haystack.includes(s));
  const answer = hit ? "YES" : "NO";
  return { answer: answer === "YES" ? "yes" : "no", rawResponse: answer, source: "mock", model: "mock-keyword-matcher" };
}

export async function askYesNo(prompt: string, input: string): Promise<DecisionResult> {
  const { hasKey, model } = llmConfig();
  if (!hasKey) return mockDecision(prompt, input);

  try {
    const completion = await getClient().chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `INPUT:\n${input || "(empty)"}\n\nQUESTION:\n${prompt}\n\nAnswer YES or NO.` },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const answer = parseYesNo(raw);
    if (!answer) {
      // Retriable: models occasionally add words. A second attempt almost always fixes it.
      throw new Error(`Model did not return YES or NO (got: ${JSON.stringify(raw.slice(0, 80))})`);
    }
    return { answer, rawResponse: raw.trim(), source: "openai", model };
  } catch (err) {
    const { status, code } = err as { status?: number; code?: string | null };
    // Bad key / unknown model / bad request will never succeed on retry, so stop early.
    // An exhausted quota ("no credits") also comes back as 429 but retrying cannot fix it.
    const outOfQuota = status === 429 && (code === "insufficient_quota" || /credits|quota|billing/i.test((err as Error).message));
    if (status === 400 || status === 401 || status === 403 || status === 404 || outOfQuota) {
      throw new NonRetriableError(`LLM request rejected (${status}): ${(err as Error).message}`, { cause: err });
    }
    throw err; // transient (rate limit, 5xx, network): let Inngest retry
  }
}
