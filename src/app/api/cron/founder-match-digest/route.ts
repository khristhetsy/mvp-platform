import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import * as Sentry from "@sentry/nextjs";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runFounderMatchDigest } from "@/lib/matching/match-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Weekly (Monday): email each paying founder the investors newly matched to
 * their company. Gated by CRON_SECRET. `?dry=1` returns who would be emailed
 * and the subject lines, without sending or recording anything.
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    const dryRun = new URL(request.url).searchParams.get("dry") === "1";
    const result = await runFounderMatchDigest({ dryRun });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message.slice(0, 200) : "Match digest failed.";
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
export const GET = withCronGate("/api/cron/founder-match-digest", scheduledGET);
