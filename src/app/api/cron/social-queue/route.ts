import { NextResponse } from "next/server";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { runSocialQueue } from "@/lib/social/queue";
import { evaluateAlertRules } from "@/lib/social/alerts-eval";
import { materializeDueRecurrences } from "@/lib/social/recurrence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Social publish queue pass — Vercel Cron every 5 min (see vercel.json). Claims due
// variants, publishes + comments, retries with backoff. Then evaluates funnel
// change-alert rules and notifies staff. CRON_SECRET protected.
export async function GET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  // Materialize any due recurring-post occurrences first, so freshly-due ones can publish this pass.
  const recurrences = await materializeDueRecurrences().catch((err) => ({ error: err instanceof Error ? err.message : "recurrences failed" }));
  const result = await runSocialQueue().catch((err) => ({ error: err instanceof Error ? err.message : "queue failed" }));
  const alerts = await evaluateAlertRules().catch((err) => ({ error: err instanceof Error ? err.message : "alerts failed" }));
  return NextResponse.json({ ...result, recurrences, alerts });
}
