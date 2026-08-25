import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { listLiveCalls } from "@/lib/voice/live-calls";

export const dynamic = "force-dynamic";

/** In-progress calls for the Live-now monitor (staff read; polled by the panel). */
export async function GET(): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const calls = await listLiveCalls().catch(() => []);
  return NextResponse.json({ calls });
}
