import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/supabase/auth";
import { getUpdatePaymentMethodUrl } from "@/lib/lemonsqueezy";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Returns Lemon Squeezy's hosted "update card" link for the signed in founder's own
 * subscription. Card details are entered on that page, never in iCapOS.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const profile = await requireUserProfile();
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
      .from("subscriptions")
      .select("ls_subscription_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const lsSubId = (data as { ls_subscription_id?: string | null } | null)?.ls_subscription_id;
    if (!lsSubId) {
      return NextResponse.json({ error: "No card subscription found for this account." }, { status: 404 });
    }

    return NextResponse.json({ url: await getUpdatePaymentMethodUrl(lsSubId) });
  } catch (err) {
    console.error("[billing/update-card]", err);
    return NextResponse.json({ error: "Could not open the card update page." }, { status: 500 });
  }
}
