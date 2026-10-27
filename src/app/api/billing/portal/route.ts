import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/supabase/auth";
import { billingOwnerOnlyResponse } from "@/lib/billing/billing-access";
import { getCustomerPortalUrl } from "@/lib/lemonsqueezy";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(): Promise<NextResponse> {
  try {
    const profile  = await requireUserProfile();
    const blocked = await billingOwnerOnlyResponse(profile.id);
    if (blocked) return blocked;
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
      .from("subscriptions")
      .select("ls_subscription_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const lsSubId = (data as { ls_subscription_id?: string | null } | null)?.ls_subscription_id;

    if (!lsSubId) {
      return NextResponse.json(
        { error: "No active subscription found. Please contact support." },
        { status: 404 }
      );
    }

    const url = await getCustomerPortalUrl(lsSubId);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[billing/portal]", err);
    return NextResponse.json({ error: "Could not load customer portal." }, { status: 500 });
  }
}
