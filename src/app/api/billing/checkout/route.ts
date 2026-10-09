import { NextRequest, NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { LS_VARIANT_IDS } from "@/lib/billing/pricing";
import { isPaymentsEnabled } from "@/lib/billing/pricing-guard";
import { BUY_LINKS } from "@/lib/billing/buy-links";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordFunnelEvent } from "@/lib/analytics/funnel";
import type { PlanType } from "@/lib/subscriptions/plans";

const PLAN_TO_VARIANT: Partial<Record<PlanType, string>> = {
  founder_basic: LS_VARIANT_IDS.founder_basic,
  founder_professional: LS_VARIANT_IDS.founder_professional,
};

/** Premium is paid by bank wire only (Oct 9, 2026): never sent to Lemon Squeezy. */
const PREMIUM_WIRE_RESPONSE = {
  wire: true,
  url: "/billing?plan=founder_premium",
  wireInvoiceEndpoint: "/api/billing/wire-invoice",
  message: "Premium is paid by bank wire. Request a wire invoice from your billing page.",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const peek = (await req.clone().json().catch(() => null)) as { planType?: string } | null;
  if (peek?.planType === "founder_premium") {
    return NextResponse.json(PREMIUM_WIRE_RESPONSE);
  }

  if (!isPaymentsEnabled()) {
    return NextResponse.json(
      { error: "Online checkout is not available yet. Please contact us to upgrade your plan." },
      { status: 503 },
    );
  }

  try {
    const profile = await requireUserProfile();
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
