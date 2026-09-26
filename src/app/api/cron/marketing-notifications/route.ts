import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import * as Sentry from "@sentry/nextjs";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runReminders } from "@/lib/marketing/notifications/evaluators";
import { listAdminIds } from "@/lib/marketing/notifications/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Marketing-hub reminder evaluator. Runs every 15–30 min; evaluates each admin's
 * reminder conditions and emits via the shared service (deduped per window).
 * Gated by CRON_SECRET (reuses the platform cron-secret convention).
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    const adminIds = await listAdminIds();
    const result = await runReminders(adminIds);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message.slice(0, 200) : "Reminder run failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function scheduledGET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/marketing-notifications", scheduledGET);
