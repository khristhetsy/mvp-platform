import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, type LsWebhookPayload } from "@/lib/lemonsqueezy";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isFirstActivation, LEMON_SQUEEZY_PRICES, mapStatus, variantToPlan } from "@/lib/billing/webhook-mapping";
import { isNewPastDue, keepGraceWindow } from "@/lib/billing/past-due";
import { notifyPastDue } from "@/lib/billing/past-due-alerts";
import { PLAN_PRICES } from "@/lib/subscriptions/plans";
import { recordOperationalEvent, reportServerFailure } from "@/lib/monitoring/operational-events";
import { recordFunnelEvent } from "@/lib/analytics/funnel";
import { alertStaffNewCustomer } from "@/lib/notifications/new-customer-alerts";
import { activateConvertedOrg } from "@/lib/organizations/convert-to-paid";

// Map a LemonSqueezy event to a funnel step (§8). A recurring payment is a
// renewal. A new subscription is no longer a step here: it starts on Stripe.
function funnelStepFor(eventName: string): "renewal" | null {
  if (eventName === "subscription_payment_success" || eventName === "subscription_payment_recovered") return "renewal";
  return null;
}

// Events that announce a new purchase. They are never processed, even when the id
// happens to match a row (an order id and a subscription id are different things).
const NEW_SUBSCRIPTION_EVENTS = new Set<string>(["subscription_created", "order_created"]);

/**
 * LemonSqueezy subscription webhook.
 *
 * It only updates a subscription Lemon Squeezy already bills, found by
 * `subscriptions.ls_subscription_id`. It never creates a row and never grants
 * access: every new payment starts on Stripe. An event for an id we do not hold
 * is answered 200 (so Lemon Squeezy does not retry) and logged as
 * `billing.lemon.ignored_new_subscription`.
 *
 * Every database write is checked and a failure returns 500 so LemonSqueezy
 * retries. Previously the writes were unchecked and the handler always returned
 * 200 — a failed upgrade looked identical to a successful one from both sides,
 * so a paying customer could be silently left on the wrong plan with no log.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("X-Signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: LsWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as LsWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event_name, custom_data } = payload.meta;
  const { id: lsSubId, attributes } = payload.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;

  const ignoreNewSubscription = async (reason: string): Promise<NextResponse> => {
    await recordOperationalEvent(admin, {
      action: "billing.lemon.ignored_new_subscription",
      entityType: "subscription",
      level: "warning",
      metadata: {
        ls_subscription_id: lsSubId ?? null,
        event_name,
        reason,
        profile_id: custom_data?.profile_id ?? null,
        signup_id: custom_data?.signup_id ?? null,
      },
    });
    return NextResponse.json({ received: true, ignored: "new subscription" });
  };

  if (NEW_SUBSCRIPTION_EVENTS.has(event_name)) return ignoreNewSubscription("new subscription event");
  // The Lemon Squeezy id is the only key. A profile id alone could match a Stripe
  // row or a signup that has not paid, and writing there would grant access.
  if (!lsSubId) return ignoreNewSubscription("no subscription id");

  const { data: existing, error: lookupError } = (await admin
    .from("subscriptions")
    .select("id, profile_id, pending_plan_type, plan_type, subscription_status, grace_period_ends_at, cancel_at_period_end")
    .eq("ls_subscription_id", lsSubId)
    .maybeSingle()) as {
    data: {
      id: string;
      profile_id: string;
      pending_plan_type: string | null;
      plan_type: string;
      subscription_status: string | null;
      grace_period_ends_at: string | null;
      cancel_at_period_end: boolean | null;
    } | null;
    error: { message: string } | null;
  };
  if (lookupError) {
    await reportServerFailure("billing.webhook.lookup_failed", new Error(lookupError.message), {
      event_name,
      ls_subscription_id: lsSubId,
    });
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  if (!existing) return ignoreNewSubscription("unknown subscription id");

  const { plan, source } = variantToPlan(attributes.variant_id, attributes.variant_name, attributes.product_name);

  // A wire Premium replaced a card subscription that is cancelled and keeps sending
  // events (cancelled, expired). Those events are for the old Basic or Professional
  // product, and must not rewrite the Premium row. Events for the Premium product
  // itself are a card Premium and are processed like any other card plan.
  if (existing.plan_type === "founder_premium" && plan !== "founder_premium") {
    return NextResponse.json({ received: true, ignored: "premium paid by wire" });
  }
  const mapped = mapStatus(attributes.status, new Date(), attributes.ends_at);

  // An unrecognised LemonSqueezy status must not silently cancel a customer.
  // Fail the delivery so it retries and shows up as a failing webhook.
  if (mapped.unknown) {
    await reportServerFailure(
      "billing.webhook.unknown_status",
      new Error(`Unrecognised LemonSqueezy status "${attributes.status}"`),
      { event_name, ls_subscription_id: lsSubId, ls_status: attributes.status },
    );
    return NextResponse.json({ error: "Unrecognised subscription status" }, { status: 500 });
  }

  if (source === "name") {
    console.warn(
      `[billing/webhook] ${event_name}: plan resolved from product name, not variant id (variant ${attributes.variant_id}). Set LEMONSQUEEZY_VARIANT_ID_BASIC / _PROFESSIONAL — renaming the product in LemonSqueezy will silently break this.`,
    );
  }

  // Repeated past_due events for one failed payment must not restart the
  // countdown, so keep the date from the first failure.
  const graceInput = {
    existingEndsAt: existing.grace_period_ends_at ?? null,
    existingCancelAtPeriodEnd: Boolean(existing.cancel_at_period_end),
    mappedEndsAt: mapped.gracePeriodEndsAt,
    mappedCancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
  };
  const graceEndsAt = keepGraceWindow(graceInput);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    ls_subscription_id: lsSubId,
    ls_customer_id: String(attributes.customer_id),
    ls_variant_id: String(attributes.variant_id),
    subscription_status: mapped.status,
    // Leave the existing plan alone when we can't resolve one, rather than
    // writing null over a plan the customer is paying for.
    plan_type: plan ?? undefined,
    current_period_start: now,
    current_period_end: attributes.renews_at ?? attributes.ends_at ?? null,
    // A past_due subscriber keeps access only until the grace period ends.
    grace_period_ends_at: graceEndsAt,
    cancel_at_period_end: mapped.cancelAtPeriodEnd,
    updated_at: now,
  };
  // The cancel reason only means something while a cancellation is pending.
  if (!mapped.cancelAtPeriodEnd) patch.cancel_reason = null;

  const pendingPlan = existing.pending_plan_type ?? null;
  if (mapped.status === "canceled" && pendingPlan === "founder_free") {
    // A scheduled downgrade to Free: the paid period is over, so land on the
    // free plan instead of an inactive subscription.
    patch.plan_type = "founder_free";
    patch.subscription_status = "free";
    patch.monthly_price_cents = 0;
    patch.pending_plan_type = null;
    patch.pending_plan_effective_at = null;
  } else if (plan && pendingPlan && plan === pendingPlan) {
    // The scheduled plan change has been applied by Lemon Squeezy.
    patch.pending_plan_type = null;
    patch.pending_plan_effective_at = null;
    patch.monthly_price_cents = LEMON_SQUEEZY_PRICES[plan] ?? PLAN_PRICES[plan];
  }

  const { error } = await admin.from("subscriptions").update(patch).eq("id", existing.id);
  if (error) {
    await reportServerFailure("billing.webhook.update_failed", new Error(error.message), {
      event_name,
      subscription_id: existing.id,
      profile_id: existing.profile_id,
      plan,
    });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  // A demo account converted to paid by card: the first payment makes it a normal paying account.
  if (mapped.status === "active") await activateConvertedOrg(admin, existing.profile_id);
  // First failed renewal payment: tell the founder (and staff, for Premium).
  if (graceEndsAt && isNewPastDue(graceInput)) {
    await notifyPastDue({
      profileId: existing.profile_id,
      subscriptionId: existing.id,
      plan: plan ?? existing.plan_type,
      endsAt: graceEndsAt,
    });
  }
  const step = funnelStepFor(event_name);
  if (step && mapped.status === "active") {
    await recordFunnelEvent({ sessionId: `webhook_${existing.profile_id}`, eventName: step, properties: { plan, event: event_name } });
  }
  // A row that already holds this Lemon Squeezy id can move back to paying
  // (resumed, or a recovered payment). Alert staff on that move. Deduped per company.
  if (isFirstActivation(existing.subscription_status, mapped.status)) {
    await alertStaffNewCustomer({ event: "payment", founderId: existing.profile_id, plan });
  }
  return NextResponse.json({ received: true, updated: existing.id });
}
