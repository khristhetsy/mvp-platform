/**
 * Chase account-activity alerts nobody assigned has opened.
 *
 * Runs every 15 minutes rather than daily: the shortest escalation window on
 * the assignment screen is "immediately", and a sweep that only ran at 08:00
 * would make that setting a lie.
 */
import { NextRequest, NextResponse } from "next/server";
import { runActivityEscalationPass } from "@/lib/activity/escalation";
import { requireRole } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Misconfigured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await runActivityEscalationPass()) });
}

/** Manual staff trigger, for checking the rules without waiting for the cron. */
export async function POST(): Promise<NextResponse> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return NextResponse.json({ ok: true, ...(await runActivityEscalationPass()) });
}
