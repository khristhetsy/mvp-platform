/**
 * Chase accepted presenters who still owe materials.
 *
 * Daily rather than hourly: the windows are 7 and 2 days out, so a finer
 * cadence would only risk sending twice for the same window — which
 * `last_reminded_at` already guards, but there is no reason to lean on it.
 */
import { NextRequest, NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { runInviteReminderPass } from "@/lib/icfo-events/invite-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function scheduledGET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Misconfigured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await runInviteReminderPass()) });
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/event-invite-reminders", scheduledGET);
