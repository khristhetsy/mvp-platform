import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { ensureTodayPhrase } from "@/lib/ceo/phrase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/ceo/phrase — today's metric-aware phrase (generates + caches if missing).
export async function GET(): Promise<Response> {
  try {
    await requireRole(["admin"]);
    return NextResponse.json({ phrase: await ensureTodayPhrase() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
