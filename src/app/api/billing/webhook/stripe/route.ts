import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyStripeEvent } from "@/lib/stripe";
import { cancelSubscription } from "@/lib/lemonsqueezy";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isFirstActivation } from "@/lib/billing/webhook-mapping";
import { mapStripeStatus, planFromStripePrice } from "@/lib/billing/stripe-mapping";
import { isNewPastDue, keepGraceWindow } from "@/lib/billing/past-due";
import { notifyPastDue } from "@/lib/billing/past-due-alerts";
import { PLAN_PRICES } from "@/lib/subscriptions/plans";
import { reportServerFailure } from "@/lib/monitoring/operational-events";
import { recordFunnelEvent } from "@/lib/analytics/funnel";
import { alertStaffNewCustomer } from "@/lib/notifications/new-customer-alerts";
import { activateConvertedOrg } from "@/lib/organizations/convert-to-paid";
import { sendFounderWelcomeLetter } from "@/lib/notifications/founder-welcome-letter";
import { assignAccountManagerForPremium } from "@/lib/team/account-manager";

export const dynamic = "force-dynamic";

const iso = (unix: number | null | undefined): string | null =>
  typeof unix === "number" ? new Date(unix * 1000).toISOString() : null;

type Existing = {
  id: string;
  profile_id: string;
  pending_plan_type: string | null;
  plan_type: string;
  subscription_status: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean | null;
  stripe_subscription_id: string | null;
};

/**
 * Stripe webhook. Mirrors the Lemon Squeezy one: every database write is checked and
 * a failure returns 500 so Stripe retries.
 *
 * Handled: checkout.session.completed (cancel the Lemon Squeezy subscription this
 * one replaces) and customer.subscription.created / updated / deleted (the source of
 * truth for plan, status and period).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const event = verifyStripeEvent(rawBody, req.headers.get("stripe-signature") ?? "");
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription(event.data.object);
    default:
      return NextResponse.json({ received: true, ignored: event.type });
  }
}

/**
 * A founder who moved from Lemon Squeezy to Stripe: once the Stripe payment has gone
 * through, stop the Lemon Squeezy renewal so they are never charged twice. Fails the
 * delivery on error so Stripe retries and the failure is noticed.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<NextResponse> {
  if (session.mode !== "subscription") return NextResponse.json({ received: true, ignored: "not a subscription" });
  if (session.payment_status === "unpaid") return NextResponse.json({ received: true, ignored: "unpaid" });

  const lsId = session.metadata?.replaces_ls_subscription_id;
  if (!lsId) return NextResponse.json({ received: true });
  try {
    await cancelSubscription(lsId);
  } catch (err) {
    await reportServerFailure("billing.stripe.cancel_lemon_failed", err instanceof Error ? err : new Error(String(err)), {
      checkout_session: session.id,
      ls_subscription_id: lsId,
      profile_id: session.metadata?.profile_id,
    });
    return NextResponse.json({ error: "Could not cancel the Lemon Squeezy subscription" }, { status: 500 });
  }
  return NextResponse.json({ received: true, cancelled_lemon: lsId });
}

async function syncSubscription(sub: Stripe.Subscription): Promise<NextResponse> {
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  const resolved = planFromStripePrice(priceId);
  const profileId = sub.metadata?.profile_id ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  if (!resolved) {
    await reportServerFailure("billing.stripe.unmapped_price", new Error(`Stripe price ${priceId} does not map to a known plan`), {
      stripe_subscription_id: sub.id,
      profile_id: profileId,
      price_id: priceId,
    });
    return NextResponse.json({ error: "Unmapped plan price" }, { status: 500 });
  }
  const plan = resolved.plan;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;
  const cols = "id, profile_id, pending_plan_type, plan_type, subscription_status, grace_period_ends_at, cancel_at_period_end, stripe_subscription_id";

  let existing: Existing | null = null;
  {
    const bySub = await admin.from("subscriptions").select(cols).eq("stripe_subscription_id", sub.id).maybeSingle();
    if (bySub.error) {
      await reportServerFailure("billing.stripe.lookup_failed", new Error(bySub.error.message), { stripe_subscription_id: sub.id });
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
    existing = bySub.data as Existing | null;
    if (!existing && profileId) {
      const byProfile = await admin.from("subscriptions").select(cols).eq("profile_id", profileId).maybeSingle();
      if (byProfile.error) {
        await reportServerFailure("billing.stripe.lookup_failed", new Error(byProfile.error.message), { profile_id: profileId });
        return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
      }
      existing = byProfile.data as Existing | null;
    }
  }
  if (!existing && !profileId) {
    console.warn(`[billing/webhook/stripe] ${sub.id}: no subscription row and no profile_id in metadata, ignoring.`);
    return NextResponse.json({ received: true, ignored: "no target" });
  }

  // A wire Premium replaced a card subscription that is cancelled and keeps sending
  // events. Those events are for the old plan and must not rewrite the Premium row.
  if (existing?.plan_type === "founder_premium" && plan !== "founder_premium" && existing.stripe_subscription_id !== sub.id) {
    return NextResponse.json({ received: true, ignored: "premium paid by wire" });
  }

  const periodEnd = iso(item?.current_period_end);
  const periodStart = iso(item?.current_period_start);
  const mapped = mapStripeStatus(sub.status, { cancelAtPeriodEnd: sub.cancel_at_period_end, periodEnd });

  if (mapped.unknown) {
    await reportServerFailure("billing.stripe.unknown_status", new Error(`Unrecognised Stripe status "${sub.status}"`), {
      stripe_subscription_id: sub.id,
    });
    return NextResponse.json({ error: "Unrecognised subscription status" }, { status: 500 });
  }
  // The first payment has not gone through. No paid entitlements until it does.
  if (mapped.status === "pending_payment") return NextResponse.json({ received: true, ignored: "incomplete" });

  // An older Stripe subscription ending after the founder subscribed again.
  if (existing?.stripe_subscription_id && existing.stripe_subscription_id !== sub.id && mapped.status === "canceled") {
    return NextResponse.json({ received: true, ignored: "stale subscription" });
  }

  const graceInput = {
    existingEndsAt: existing?.grace_period_ends_at ?? null,
    existingCancelAtPeriodEnd: Boolean(existing?.cancel_at_period_end),
    mappedEndsAt: mapped.gracePeriodEndsAt,
    mappedCancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
  };
  const graceEndsAt = keepGraceWindow(graceInput);

  const now = new Date().toISOString();
  // Record what Stripe actually charges. The price on a legacy subscription is lower
  // than the current catalogue price, so PLAN_PRICES would overstate it.
  const chargedCents = item?.price?.unit_amount ?? PLAN_PRICES[plan];
  const patch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    stripe_price_id: priceId,
    // The founder is now billed by Stripe: clear the Lemon Squeezy ids so a late
    // Lemon Squeezy event for the old subscription cannot rewrite this row.
    ls_subscription_id: null,
    ls_customer_id: null,
    ls_variant_id: null,
    subscription_status: mapped.status,
    plan_type: plan,
    current_period_start: periodStart ?? now,
    current_period_end: periodEnd,
    grace_period_ends_at: graceEndsAt,
    cancel_at_period_end: mapped.cancelAtPeriodEnd,
    monthly_price_cents: chargedCents,
    currency: (item?.price?.currency ?? "usd").toUpperCase(),
    updated_at: now,
  };
  if (!mapped.cancelAtPeriodEnd) patch.cancel_reason = null;

  const pendingPlan = existing?.pending_plan_type ?? null;
  if (mapped.status === "canceled" && pendingPlan === "founder_free") {
    // A scheduled downgrade to Free: the paid period is over, land on the free plan.
    patch.plan_type = "founder_free";
    patch.subscription_status = "free";
    patch.monthly_price_cents = 0;
    patch.pending_plan_type = null;
    patch.pending_plan_effective_at = null;
  } else if (pendingPlan && plan === pendingPlan) {
    // The scheduled plan change has been applied by Stripe.
    patch.pending_plan_type = null;
    patch.pending_plan_effective_at = null;
  }

  if (existing) {
    const { error } = await admin.from("subscriptions").update(patch).eq("id", existing.id);
    if (error) {
      await reportServerFailure("billing.stripe.update_failed", new Error(error.message), {
        stripe_subscription_id: sub.id,
        subscription_id: existing.id,
        plan,
      });
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  } else {
    const { error } = await admin.from("subscriptions").upsert(
      { ...patch, profile_id: profileId, role: "founder" },
      { onConflict: "profile_id" },
    );
    if (error) {
      await reportServerFailure("billing.stripe.create_failed", new Error(error.message), {
        stripe_subscription_id: sub.id,
        profile_id: profileId,
        plan,
      });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }
  }

  const founderId = existing?.profile_id ?? (profileId as string);

  // A demo account converted to paid by card: the first payment makes it a normal paying account.
  if (mapped.status === "active") await activateConvertedOrg(admin, founderId);

  // First failed renewal payment: tell the founder (and staff, for Premium).
  if (existing && graceEndsAt && isNewPastDue(graceInput)) {
    await notifyPastDue({ profileId: founderId, subscriptionId: existing.id, plan, endsAt: graceEndsAt });
  }

  // First payment: funnel step, welcome letter, staff alert, Premium account manager.
  // Keyed off the status change, not the event name, so a founder moved over from
  // Lemon Squeezy (already active) does not get a second welcome.
  if (isFirstActivation(existing?.subscription_status, mapped.status)) {
    await recordFunnelEvent({ sessionId: `webhook_${founderId}`, eventName: "checkout_complete", properties: { plan, event: "stripe.subscription" } });
    await sendFounderWelcomeLetter({ founderId, plan });
    await alertStaffNewCustomer({ event: "payment", founderId, plan });
    if (plan === "founder_premium") await assignAccountManagerForPremium({ founderId });
  }

  return NextResponse.json({ received: true, synced: founderId });
}
