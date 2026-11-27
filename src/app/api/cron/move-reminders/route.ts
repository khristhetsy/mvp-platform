import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { CRON_SUMMARY_HEADER, withCronGate } from "@/lib/cron/gate";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runMoveReminders } from "@/lib/billing/move-reminder";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Daily: one email to each Lemon Squeezy customer whose renewal is inside the reminder window,
 * asking them to add their card on Stripe through their own move link. One email per customer
 * per renewal, so a rerun is harmless.
 *
 * Nothing sends until the platform setting billing_move_reminder_enabled is switched on. While
 * it is off the job only records who it would have emailed.
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    const run = await runMoveReminders();
    const summary = run.enabled
      ? `${run.sent} sent, ${run.failed} failed, ${run.alreadySent} already sent`
      : `Switch off: ${run.wouldSend} would be sent`;
    return NextResponse.json({ ok: true, ...run }, { headers: { [CRON_SUMMARY_HEADER]: summary } });
  } catch (err) {
    Sentry.captureException(err, { tags: { pass: "move_reminders" } });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Move reminders failed." }, { status: 500 });
  }
}

async function scheduledGET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export const GET = withCronGate("/api/cron/move-reminders", scheduledGET);
