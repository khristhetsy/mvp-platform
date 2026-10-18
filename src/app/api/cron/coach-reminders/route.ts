import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import * as Sentry from "@sentry/nextjs";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runCoachReminderPass } from "@/lib/learning/coach/reminders-pass";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * AI IR Coach commitment checks, every 15 minutes. When a founder says "Not now" on a step they pick
 * a time; this job meets that time closely instead of waiting for the daily founder-nudges run.
 *
 * It sends commitment checks only. Quiet founder nudges (3, 7 and 14 days) stay on the daily run, so
 * their cadence does not change. The pass does nothing until an admin switches the coach on for a
 * course that counsel reviewed and founders are enrolled. Repeats are impossible: every message is
 * recorded in coach_messages and planned only once. Emails follow the founder email budget as a
 * digest tier job, the same as the daily run.
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  try {
    const result = await runCoachReminderPass(300, new Date(), ["commitment_check"]);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err, { tags: { pass: "coach_commitment_checks" } });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "failed" }, { status: 500 });
  }
}

async function scheduledGET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/coach-reminders", scheduledGET);
