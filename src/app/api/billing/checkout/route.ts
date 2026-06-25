import { NextRequest, NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { LS_VARIANT_IDS } from "@/lib/billing/pricing";
import { isPaymentsEnabled } from "@/lib/billing/pricing-guard";
import type { PlanType } from "@/lib/subscriptions/plans";

const PLAN_TO_VARIANT: Partial<Record<PlanType, string>> = {
  founder_basic: LS_VARIANT_IDS.founder_basic,
  founder_professional: LS_VARIANT_IDS.founder_professional,
};

// Direct Lemon Squeezy "Buy" links — copied from the dashboard (Share button).
// No API key / store / variant lookup needed, so no mode-mismatch 404s.
const PLAN_TO_BUY_URL: Partial<Record<PlanType, string | undefined>> = {
  founder_basic: process.env.LEMONSQUEEZY_CHECKOUT_URL_BASIC,
  founder_professional: process.env.LEMONSQUEEZY_CHECKOUT_URL_PROFESSIONAL,
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
    const { planType } = (await req.json()) as { planType: PlanType };

    // Preferred path: redirect straight to the Lemon Squeezy buy link, attaching
    // the founder's email + profile_id (the webhook reads custom_data.profile_id).
    const buyUrl = PLAN_TO_BUY_URL[planType];
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
