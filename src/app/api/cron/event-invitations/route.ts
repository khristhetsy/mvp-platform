/**
 * Event Hub invitations: sends due invitation steps and attendee emails.
 * Every 15 minutes, so a "1 hour before" reminder lands inside its window.
 */
import { NextRequest, NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { runEventInvitationPass } from "@/lib/icfo-events/invitations/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function scheduledGET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Misconfigured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await runEventInvitationPass()) });
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/event-invitations", scheduledGET);
