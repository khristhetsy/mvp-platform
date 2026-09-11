/**
 * A single recurrence series. Staff-only.
 *   GET   → { summary }        (for the Schedule detail card)
 *   PATCH { action: "pause" | "resume" | "end" } → { ok }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { recurrenceSummary, setRecurrenceStatus } from "@/lib/social/recurrence";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  const summary = await recurrenceSummary(id);
  if (!summary) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ summary });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const { id } = await params;
  const parsed = z.object({ action: z.enum(["pause", "resume", "end"]) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const status = parsed.data.action === "pause" ? "paused" : parsed.data.action === "resume" ? "active" : "ended";
  const ok = await setRecurrenceStatus(id, status);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
