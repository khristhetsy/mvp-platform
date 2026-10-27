import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, type LsWebhookPayload } from "@/lib/lemonsqueezy";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mapStatus, variantToPlan } from "@/lib/billing/webhook-mapping";
import { PLAN_PRICES } from "@/lib/subscriptions/plans";
import { reportServerFailure } from "@/lib/monitoring/operational-events";
import { recordFunnelEvent } from "@/lib/analytics/funnel";
import { alertStaffNewCustomer } from "@/lib/notifications/new-customer-alerts";
import { sendFounderWelcomeLetter } from "@/lib/notifications/founder-welcome-letter";
import { assignAccountManagerForPremium } from "@/lib/team/account-manager";

// Map a LemonSqueezy event to a funnel step (§8). New paid subscription →
// checkout_complete; a recurring payment → renewal. Others aren't funnel steps.
function funnelStepFor(eventName: string): "checkout_complete" | "renewal" | null {
  if (eventName === "subscription_created" || eventName === "order_created") return "checkout_complete";
  if (eventName === "subscription_payment_success" || eventName === "subscription_payment_recovered") return "renewal";
  return null;
}

/**
 * LemonSqueezy subscription webhook.
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
  const profileId = custom_data?.profile_id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;

  let query = admin.from("subscriptions").select("id, profile_id, pending_plan_type, plan_type");
  if (lsSubId) {
    query = query.eq("ls_subscription_id", lsSubId);
  } else if (profileId) {
    query = query.eq("profile_id", profileId);
  } else {
    console.warn(`[billing/webhook] ${event_name}: no subscription id or profile_id — ignoring.`);
    return NextResponse.json({ received: true, ignored: "no identifier" });
  }

  const { data: existing, error: lookupError } = (await query.maybeSingle()) as {
    data: { id: string; profile_id: string; pending_plan_type: string | null; plan_type: string } | null;
    error: { message: string } | null;
  };
  if (lookupError) {
    await reportServerFailure("billing.webhook.lookup_failed", new Error(lookupError.message), {
      event_name,
      ls_subscription_id: lsSubId,
      profile_id: profileId,
    });
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  const { plan, source } = variantToPlan(attributes.variant_id, attributes.variant_name, attributes.product_name);

  // A wire Premium replaced a card subscription that is cancelled and keeps sending
  // events (cancelled, expired). Those events are for the old Basic or Professional
  // product, and must not rewrite the Premium row. Events for the Premium product
  // itself are a card Premium and are processed like any other card plan.
  if (existing?.plan_type === "founder_premium" && plan !== "founder_premium") {
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
    grace_period_ends_at: mapped.gracePeriodEndsAt,
    cancel_at_period_end: mapped.cancelAtPeriodEnd,
    updated_at: now,
  };
  // The cancel reason only means something while a cancellation is pending.
  if (!mapped.cancelAtPeriodEnd) patch.cancel_reason = null;

  const pendingPlan = existing?.pending_plan_type ?? null;
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
    patch.monthly_price_cents = PLAN_PRICES[plan];
  }

  if (existing) {
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
    const step = funnelStepFor(event_name);
    if (step && mapped.status === "active") {
      await recordFunnelEvent({ sessionId: `webhook_${existing.profile_id}`, eventName: step, properties: { plan, event: event_name } });
      if (step === "checkout_complete") {
        // Welcome letter first, so the staff alert can say it went out.
        await sendFounderWelcomeLetter({ founderId: existing.profile_id, plan });
        await alertStaffNewCustomer({ event: "payment", founderId: existing.profile_id, plan });
        if (plan === "founder_premium") await assignAccountManagerForPremium({ founderId: existing.profile_id });
      }
    }
    return NextResponse.json({ received: true, updated: existing.id });
  }

  if (profileId) {
    if (!plan) {
      // Creating a subscription with no plan but a hardcoded price is how a
      // $1,000 customer got recorded at $499. Refuse and retry instead.
      await reportServerFailure(
        "billing.webhook.unmapped_variant",
        new Error(`Variant ${attributes.variant_id} does not map to a known plan`),
        {
          event_name,
          profile_id: profileId,
          variant_id: attributes.variant_id,
          product_name: attributes.product_name,
          variant_name: attributes.variant_name,
        },
      );
      return NextResponse.json({ error: "Unmapped plan variant" }, { status: 500 });
    }

    const { error } = await admin.from("subscriptions").upsert(
      {
        ...patch,
        profile_id: profileId,
        role: "founder",
        // Single source of truth — this used to be two hardcoded literals that
        // could drift from the pricing table.
        monthly_price_cents: PLAN_PRICES[plan],
        currency: "USD",
      },
      { onConflict: "profile_id" },
    );
    if (error) {
      await reportServerFailure("billing.webhook.create_failed", new Error(error.message), {
        event_name,
        profile_id: profileId,
        plan,
      });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }
    const step = funnelStepFor(event_name);
    if (step && mapped.status === "active") {
      await recordFunnelEvent({ sessionId: `webhook_${profileId}`, eventName: step, properties: { plan, event: event_name } });
      if (step === "checkout_complete") {
        // Welcome letter first, so the staff alert can say it went out.
        await sendFounderWelcomeLetter({ founderId: profileId, plan });
        await alertStaffNewCustomer({ event: "payment", founderId: profileId, plan });
        if (plan === "founder_premium") await assignAccountManagerForPremium({ founderId: profileId });
      }
    }
    return NextResponse.json({ received: true, created: profileId });
  }

  console.warn(`[billing/webhook] ${event_name}: no existing subscription and no profile_id — nothing written.`);
  return NextResponse.json({ received: true, ignored: "no target" });
}
