import { NextRequest, NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/supabase/auth";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { LS_VARIANT_IDS } from "@/lib/billing/pricing";
import { isPaymentsEnabled } from "@/lib/billing/pricing-guard";
import type { PlanType } from "@/lib/subscriptions/plans";

const PLAN_TO_VARIANT: Partial<Record<PlanType, string>> = {
  founder_basic:        LS_VARIANT_IDS.founder_basic,
  founder_professional: LS_VARIANT_IDS.founder_professional,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isPaymentsEnabled()) {
    return NextResponse.json(
      { error: "Online checkout is not available yet. Please contact us to upgrade your plan." },
      { status: 503 }
    );
  }

  try {
    const profile = await requireUserProfile();
    const { planType } = (await req.json()) as { planType: PlanType };

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
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
