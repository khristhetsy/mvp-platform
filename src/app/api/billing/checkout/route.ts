import { NextRequest, NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/supabase/auth";
import { billingOwnerOnlyResponse } from "@/lib/billing/billing-access";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { LS_VARIANT_IDS } from "@/lib/billing/pricing";
import { isPaymentsEnabled } from "@/lib/billing/pricing-guard";
import { BUY_LINKS } from "@/lib/billing/buy-links";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordFunnelEvent } from "@/lib/analytics/funnel";
import type { PlanType } from "@/lib/subscriptions/plans";
import { findCurrentAcceptance } from "@/lib/billing/premium-agreement";
import { createStripeCheckoutUrl, stripeConfigured } from "@/lib/stripe";
import { isStripePlan, keepsLegacyPrice, lemonRenewalAnchor, managedPaymentsFor, stripePriceId, type PriceHolder } from "@/lib/billing/stripe-mapping";
import { isCardSubscription } from "@/lib/billing/plan-change";

const PLAN_TO_VARIANT: Partial<Record<PlanType, string>> = {
  founder_basic: LS_VARIANT_IDS.founder_basic,
  founder_professional: LS_VARIANT_IDS.founder_professional,
  founder_premium: LS_VARIANT_IDS.founder_premium,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isPaymentsEnabled()) {
    return NextResponse.json(
      { error: "Online checkout is not available yet. Please contact us to upgrade your plan." },
      { status: 503 },
    );
  }

  try {
    const profile = await requireUserProfile();
    const blocked = await billingOwnerOnlyResponse(profile.id);
    if (blocked) return blocked;
    const { planType, refundPolicyAcceptedAt, refundPolicyVersion } = (await req.json()) as {
      planType: PlanType;
      refundPolicyAcceptedAt?: string;
      refundPolicyVersion?: string;
    };

    // Enforce the non-refundable acknowledgment server-side too (defense in depth
    // — not just the UI checkbox), so no checkout proceeds without recorded consent.
    if (!refundPolicyAcceptedAt) {
      return NextResponse.json({ error: "Please accept the billing terms to continue." }, { status: 400 });
    }

    // Premium carries the iCFO Services Agreement. Enforced here as well as in the
    // dialog, so no Premium checkout starts without a recorded acceptance of the
    // current agreement text. Fails closed when the record cannot be read.
    if (planType === "founder_premium") {
      let accepted = null;
      try {
        accepted = await findCurrentAcceptance(profile.id);
      } catch (e) {
        console.error("[billing/checkout] agreement lookup failed", e);
        return NextResponse.json({ error: "We could not confirm your agreement. Please try again, or contact us.", code: "agreement_unavailable" }, { status: 503 });
      }
      if (!accepted) {
        return NextResponse.json({ error: "Please review and accept the Services Agreement to continue.", code: "agreement_required" }, { status: 400 });
      }
    }

    // Funnel: a checkout was initiated (§8). Session keyed to the profile.
    await recordFunnelEvent({ sessionId: `checkout_${profile.id}`, eventName: "checkout_start", properties: { plan: planType } });

    // Record the acknowledgment (audit trail for chargeback/dispute defense).
    // Best-effort: never block checkout if the write fails.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = createServiceRoleClient() as any;
      await admin.from("billing_consents").insert({
        profile_id: profile.id,
        email: profile.email ?? null,
        plan_type: planType,
        policy_version: refundPolicyVersion ?? null,
        accepted_at: refundPolicyAcceptedAt,
        user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      });
    } catch (e) {
      console.error("[billing/checkout] consent record failed (non-fatal)", e);
    }

    // Stripe, when configured: Lemon Squeezy shuts down March 31, 2027.
    // Price rule: a subscriber with a continuous active subscription on the plan they
    // are buying keeps the legacy price ($49 Basic, $1,000 Premium). Everyone else
    // (never paid, cancelled and returning, upgrading from another plan) pays the
    // current price ($99 Basic, $199 Professional, $1,500 Premium).
    if (stripeConfigured()) {
      if (!isStripePlan(planType)) {
        return NextResponse.json({ error: "Invalid plan type." }, { status: 400 });
      }
      const db = createServiceRoleClient();
      const { data: rowRaw } = await db
        .from("subscriptions")
        .select("plan_type, subscription_status, ls_subscription_id, ls_variant_id, stripe_subscription_id, stripe_customer_id, cancel_at_period_end, grace_period_ends_at, current_period_end")
        .eq("profile_id", profile.id)
        .maybeSingle();
      const row = rowRaw as (PriceHolder & {
        ls_variant_id: string | null;
        stripe_subscription_id: string | null;
        stripe_customer_id: string | null;
        current_period_end: string | null;
      }) | null;

      if (
        row?.stripe_subscription_id &&
        row.subscription_status === "active" &&
        !row.cancel_at_period_end &&
        row.plan_type === planType
      ) {
        return NextResponse.json({ error: "You are already subscribed to this plan." }, { status: 409 });
      }

      const tier = keepsLegacyPrice(row, planType) ? "legacy" : "current";
      const priceId = stripePriceId(planType, tier);
      if (!priceId) {
        // Never fall back to the current price for a legacy subscriber: they would be
        // charged more than they agreed to.
        console.error(`[billing/checkout] Stripe ${tier} price for ${planType} is not configured`);
        return NextResponse.json({ error: "Checkout is not available for this plan yet. Please contact us." }, { status: 503 });
      }

      const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com";
      // A live Lemon Squeezy subscription is cancelled by the webhook once the Stripe
      // payment succeeds, so the founder is never charged twice.
      const replaces = row?.ls_subscription_id && isCardSubscription(row) ? row.ls_subscription_id : null;
      const url = await createStripeCheckoutUrl({
        priceId,
        profileId: profile.id,
        planType,
        email: profile.email ?? null,
        customerId: row?.stripe_customer_id ?? null,
        successUrl: `${origin}/billing?checkout=success`,
        cancelUrl: `${origin}/billing`,
        managedPayments: managedPaymentsFor(planType),
        replacesLsSubscriptionId: replaces,
        // Already paid to the end of the Lemon Squeezy period: Stripe's first charge is then.
        billingCycleAnchor: replaces ? lemonRenewalAnchor(row?.current_period_end) : null,
      });
      return NextResponse.json({ url });
    }

    // Preferred path: redirect straight to the Lemon Squeezy buy link, attaching
    // the founder's email + profile_id (the webhook reads custom_data.profile_id).
    const buyUrl = BUY_LINKS[planType];
    if (buyUrl) {
      const url = new URL(buyUrl);
      if (profile.email) url.searchParams.set("checkout[email]", profile.email);
      url.searchParams.set("checkout[custom][profile_id]", profile.id);
      return NextResponse.json({ url: url.toString() });
    }

    // Fallback path: create a checkout via the API (needs API key + variant IDs).
    const variantId = PLAN_TO_VARIANT[planType];
    if (!variantId) {
      return NextResponse.json({ error: "Invalid plan type." }, { status: 400 });
    }

    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com";
    const successUrl = `${origin}/billing?checkout=success`;

    const checkoutUrl = await createCheckoutUrl({
      variantId,
      email: profile.email ?? "",
      profileId: profile.id,
      successUrl,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("[billing/checkout]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Checkout failed. ${detail.slice(0, 400)}` }, { status: 500 });
  }
}
