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
import { FREE_MOVE_DAYS, lapsedNoticeDue, reminderDue } from "@/lib/billing/past-due";
import { cancelRenewal } from "@/lib/billing/provider";
import { notifyPastDue } from "@/lib/billing/past-due-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Daily: remind founders whose renewal payment failed. Day 0 is sent by the
 * billing webhook; this job sends day 3 (24 to 48 hours left) and day 5 (under
 * 24 hours left). Once the grace period has run out it sends the notice that the
 * account moves to the Free plan. FREE_MOVE_DAYS after the grace period ends it
 * makes the move: the plan change is recorded as a pending move to Free and the
 * Lemon Squeezy subscription is cancelled, so the billing webhook lands the
 * account on the Free plan, the same path a founder's own downgrade to Free uses.
 * Each notice goes out once per failed payment, so a re-run is harmless. A
 * cancellation that runs to the end of the paid period is skipped, and so is a
 * plan with no card subscription (paid by wire).
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

  // Grace period already over, Free move date not reached yet.
  const moveCutoff = new Date(now.getTime() - FREE_MOVE_DAYS * 86_400_000).toISOString();
  const { data: lapsedData, error: lapsedError } = await admin
    .from("subscriptions")
    .select("id, profile_id, plan_type, grace_period_ends_at")
    .eq("subscription_status", "active")
    .eq("cancel_at_period_end", false)
    .like("plan_type", "founder_%")
    .not("grace_period_ends_at", "is", null)
    .lte("grace_period_ends_at", now.toISOString())
    .gt("grace_period_ends_at", moveCutoff)
    .limit(500);
  if (lapsedError) return NextResponse.json({ ok: false, error: lapsedError.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  const rows = [...(data ?? []), ...(lapsedData ?? [])] as Array<{ id: string; profile_id: string; plan_type: string; grace_period_ends_at: string }>;
  for (const row of rows) {
    const stage = reminderDue(row.grace_period_ends_at, now) ?? (lapsedNoticeDue(row.grace_period_ends_at, now) ? "lapsed" : null);
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

  // Free move date reached: record the move, then cancel the card
  // subscription (Stripe or Lemon Squeezy). The pending move is written first so the cancellation webhook
  // lands the account on Free. A failed cancellation is retried the next day.
  const { data: moveData, error: moveError } = await admin
    .from("subscriptions")
    .select("id, ls_subscription_id, stripe_subscription_id")
    .eq("subscription_status", "active")
    .eq("cancel_at_period_end", false)
    .like("plan_type", "founder_%")
    .neq("plan_type", "founder_free")
    .or("ls_subscription_id.not.is.null,stripe_subscription_id.not.is.null")
    .not("grace_period_ends_at", "is", null)
    .lte("grace_period_ends_at", moveCutoff)
    .limit(50);
  if (moveError) return NextResponse.json({ ok: false, error: moveError.message }, { status: 500 });

  let moved = 0;
  let moveFailed = 0;
  for (const row of moveData ?? []) {
    try {
      const { error: pendingError } = await admin
        .from("subscriptions")
        .update({ pending_plan_type: "founder_free", pending_plan_effective_at: now.toISOString() })
        .eq("id", row.id);
      if (pendingError) throw new Error(pendingError.message);
      await cancelRenewal(row);
      moved += 1;
    } catch (err) {
      moveFailed += 1;
      Sentry.captureException(err, { tags: { pass: "past_due_free_move" } });
    }
  }
  return NextResponse.json({ ok: true, due: rows.length, sent, failed, moved, moveFailed });
}

async function scheduledGET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export const GET = withCronGate("/api/cron/past-due-reminders", scheduledGET);
