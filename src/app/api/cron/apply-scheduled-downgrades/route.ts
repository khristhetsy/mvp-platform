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
import { changeRenewalPlan } from "@/lib/billing/provider";
import { stripePriceId } from "@/lib/billing/stripe-mapping";
import { DOWNGRADE_LEAD_MS } from "@/lib/billing/plan-change";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Daily: apply scheduled Professional to Basic downgrades. The provider changes
 * the plan immediately, so this runs one day before the period ends, which keeps
 * the next renewal at the Basic price. The webhook then writes the new plan and
 * clears the pending change. Downgrades to Free are handled by the cancellation
 * itself and the `expired` webhook, not here.
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  // Lemon Squeezy rows move to the Basic variant, Stripe rows to the current Basic
  // price. Each needs its own id; a row is skipped (and counted failed) without it.
  const lsVariantId = process.env.LEMONSQUEEZY_VARIANT_ID_BASIC?.trim() || null;
  const basicStripePrice = stripePriceId("founder_basic", "current");
  if (!lsVariantId && !basicStripePrice) {
    return NextResponse.json({ ok: false, error: "Neither LEMONSQUEEZY_VARIANT_ID_BASIC nor STRIPE_PRICE_BASIC is set." }, { status: 500 });
  }

  const admin = createServiceRoleClient();
  const cutoff = new Date(Date.now() + DOWNGRADE_LEAD_MS).toISOString();
  const { data, error } = await admin
    .from("subscriptions")
    .select("id, ls_subscription_id, stripe_subscription_id")
    .eq("pending_plan_type", "founder_basic")
    .eq("cancel_at_period_end", false)
    .or("ls_subscription_id.not.is.null,stripe_subscription_id.not.is.null")
    .lte("pending_plan_effective_at", cutoff)
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let applied = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      await changeRenewalPlan(row, { lsVariantId, stripePriceId: basicStripePrice });
      applied += 1;
    } catch (err) {
      failed += 1;
      Sentry.captureException(err, { tags: { pass: "apply_scheduled_downgrades" } });
    }
  }
  return NextResponse.json({ ok: true, due: data?.length ?? 0, applied, failed });
}

async function scheduledGET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export const GET = withCronGate("/api/cron/apply-scheduled-downgrades", scheduledGET);
