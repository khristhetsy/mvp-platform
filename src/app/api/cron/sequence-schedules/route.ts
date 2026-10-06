import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withCronGate } from "@/lib/cron/gate";
import { cronMisconfiguredResponse, cronUnauthorizedResponse, getCronSecret, validateCronSecret } from "@/lib/notifications/cron/auth";
import { runSequenceSchedules } from "@/lib/marketing/sequence-schedule-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Sequence scheduled sends. Every 5 minutes: releases pending sequence batches
 * whose schedule time (PT) has come, up to each schedule's max per run, sends
 * batches moved to a one off time, and reminds the approver before each run.
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  try {
    const result = await runSequenceSchedules(new Date(), 240_000);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "Run failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/sequence-schedules", handle);
