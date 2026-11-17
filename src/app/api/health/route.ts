import { NextResponse } from "next/server";

import { llmConfig } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the UI show whether the LLM key is set and whether the Inngest dev server is up. */
export async function GET() {
  const { hasKey, model } = llmConfig();
  const base = process.env.INNGEST_BASE_URL || "http://127.0.0.1:8288";
  let inngestReachable = false;
  try {
    const res = await fetch(base, { signal: AbortSignal.timeout(1200), cache: "no-store" });
    inngestReachable = res.status < 500;
  } catch {
    inngestReachable = false;
  }
  return NextResponse.json({ llm: hasKey ? "openai" : "mock", model: hasKey ? model : "mock", inngestReachable });
}
