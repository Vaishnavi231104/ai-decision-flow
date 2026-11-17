import { NextResponse } from "next/server";

import { getRun } from "@/lib/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  try {
    const run = await getRun(runId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    return NextResponse.json({ run });
  } catch {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }
}
