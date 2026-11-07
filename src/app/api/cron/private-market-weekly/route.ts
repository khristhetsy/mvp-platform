import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withCronGate } from "@/lib/cron/gate";
import { cronMisconfiguredResponse, cronUnauthorizedResponse, getCronSecret, validateCronSecret } from "@/lib/notifications/cron/auth";
import { runWeeklyEmails } from "@/lib/private-market/weekly-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Private Market weekly emails. Every 5 minutes: sends the founder and investor
 * versions at their scheduled time (PT) to the recipients chosen at Admin,
 * Private Market board, Weekly emailer, and reminds the approver beforehand.
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();
  try {
    const result = await runWeeklyEmails(new Date(), 240_000);
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
export const GET = withCronGate("/api/cron/private-market-weekly", handle);
