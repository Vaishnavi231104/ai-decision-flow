import { NextResponse } from "next/server";

import { deleteAllRuns, listRuns } from "@/lib/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ runs: await listRuns() });
}

export async function DELETE() {
  await deleteAllRuns();
  return NextResponse.json({ ok: true });
}
