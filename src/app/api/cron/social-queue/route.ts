import { NextResponse } from "next/server";
import { withCronGate } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { runSocialQueue } from "@/lib/social/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Social PUBLISH pass — Vercel Cron every 5 min (see vercel.json). Claims due variants,
// publishes + comments, retries with backoff. CRON_SECRET protected.
//
// Publishing is the only genuinely minute-sensitive work here: a post scheduled for 09:00
// must not go out at 09:25. Recurrence materialization (45-day horizon) and funnel alert
// evaluation (per-period, once-per-period guard) gain nothing from a 5-minute cadence and
// were by far the most expensive thing on this schedule — alert evaluation recomputed the
// whole funnel, including unbounded crm_contacts JSONB scans, 288 times a day to produce
// nothing. Both now live on /api/cron/social-maintenance, hourly.
async function scheduledGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  const result = await runSocialQueue().catch((err) => ({ error: err instanceof Error ? err.message : "queue failed" }));
  return NextResponse.json(result);
}

// Pause switch and run log: Admin, System, Scheduled jobs.
export const GET = withCronGate("/api/cron/social-queue", scheduledGET);
