import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withCronGate } from "@/lib/cron/gate";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { reminderDue } from "@/lib/billing/past-due";
import { notifyPastDue } from "@/lib/billing/past-due-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Daily: remind founders whose renewal payment failed. Day 0 is sent by the
 * billing webhook; this job sends day 3 (24 to 48 hours left) and day 5 (under
 * 24 hours left). Each reminder goes out once per failed payment, so a re-run is
 * harmless. A cancellation that runs to the end of the paid period is skipped.
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  const admin = createServiceRoleClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + 48 * 3_600_000).toISOString();
  const { data, error } = await admin
    .from("subscriptions")
    .select("id, profile_id, plan_type, grace_period_ends_at")
    .eq("subscription_status", "active")
    .eq("cancel_at_period_end", false)
    .like("plan_type", "founder_%")
    .not("grace_period_ends_at", "is", null)
    .gt("grace_period_ends_at", now.toISOString())
    .lte("grace_period_ends_at", horizon)
    .limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const row of (data ?? []) as Array<{ id: string; profile_id: string; plan_type: string; grace_period_ends_at: string }>) {
    const stage = reminderDue(row.grace_period_ends_at, now);
    if (!stage) continue;
    try {
      await notifyPastDue({
        profileId: row.profile_id,
        subscriptionId: row.id,
        plan: row.plan_type,
        endsAt: row.grace_period_ends_at,
        stage,
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      Sentry.captureException(err, { tags: { pass: "past_due_reminders" } });
    }
  }
  return NextResponse.json({ ok: true, due: data?.length ?? 0, sent, failed });
}

async function scheduledGET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export const GET = withCronGate("/api/cron/past-due-reminders", scheduledGET);
