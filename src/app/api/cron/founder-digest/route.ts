import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withCronGate } from "@/lib/cron/gate";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runFounderDigestPass } from "@/lib/notifications/founder-email-budget/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Hourly founder digest. Sends each founder their held updates in one email at
 * their own hour (daily, or Mondays for weekly), under the rules set at Admin,
 * System, Scheduled jobs, Founder email. Nothing is held, so nothing is sent,
 * until the rollout there is above 0%.
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  try {
    const result = await runFounderDigestPass();
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err, { tags: { job: "founder-digest" } });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "Digest failed" }, { status: 500 });
  }
}

async function scheduledGET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/founder-digest", scheduledGET);
