import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/supabase/auth";
import { getUpdatePaymentMethodUrl } from "@/lib/lemonsqueezy";
import { createStripePortalUrl } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { billingOwnerOnlyResponse } from "@/lib/billing/billing-access";

/**
 * Returns the provider's hosted "update card" link (Stripe or Lemon Squeezy) for the
 * signed in founder's own subscription. Card details are entered on that page, never in iCapOS.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const profile = await requireUserProfile();
    const blocked = await billingOwnerOnlyResponse(profile.id);
    if (blocked) return blocked;
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
      .from("subscriptions")
      .select("ls_subscription_id, stripe_customer_id, stripe_subscription_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const row = data as { ls_subscription_id?: string | null; stripe_customer_id?: string | null; stripe_subscription_id?: string | null } | null;
    if (row?.stripe_subscription_id && row.stripe_customer_id) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com";
      return NextResponse.json({ url: await createStripePortalUrl(row.stripe_customer_id, `${origin}/billing`, true) });
    }
    const lsSubId = row?.ls_subscription_id;
    if (!lsSubId) {
      return NextResponse.json({ error: "No card subscription found for this account." }, { status: 404 });
    }

    return NextResponse.json({ url: await getUpdatePaymentMethodUrl(lsSubId) });
  } catch (err) {
    console.error("[billing/update-card]", err);
    return NextResponse.json({ error: "Could not open the card update page." }, { status: 500 });
  }
}
