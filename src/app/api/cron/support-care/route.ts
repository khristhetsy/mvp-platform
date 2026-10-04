import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withCronGate, CRON_SUMMARY_HEADER } from "@/lib/cron/gate";
import { runSupportCarePass } from "@/lib/support/care";

export const dynamic = "force-dynamic";

/**
 * Every 15 minutes: staff reminders until a request is resolved, "reply due in
 * 2 hours" alerts, escalation plus an honest "more time" note to the founder
 * when a promised reply time is missed, a nudge when the founder owes a reply,
 * and the "did this solve your issue?" reminder (day 2) and close (day 7).
 * Settings: Admin, Customer Support, Support queue, Notifications.
 */
async function scheduledGET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSupportCarePass();
    const summary = `${result.reminders} reminders, ${result.dueSoon} due soon, ${result.overdue} overdue, ${result.founderNudges} founder nudges, ${result.confirmReminders} solve checks, ${result.closed} closed`;
    return NextResponse.json(result, { headers: { [CRON_SUMMARY_HEADER]: summary } });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "The support care pass failed." }, { status: 500 });
  }
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/support-care", scheduledGET);
