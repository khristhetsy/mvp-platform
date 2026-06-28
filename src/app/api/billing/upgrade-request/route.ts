import { NextResponse } from "next/server";
import { createUpgradeRequest } from "@/lib/billing/upgrade-requests";
import { parseUpgradeFeature, parseUpgradePlan, parseUpgradeRequestType } from "@/lib/billing/upgrade";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const requestType = parseUpgradeRequestType(body.requestType);

  if (!requestType) {
    return NextResponse.json({ error: "Invalid request type." }, { status: 400 });
  }

  const requestedPlan = parseUpgradePlan(body.requestedPlan);
  const featureKey = parseUpgradeFeature(body.featureKey);

  try {
    await createUpgradeRequest({
      profileId: user.id,
      requestType,
      requestedPlan,
      featureKey,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    const message =
      requestType === "notify_billing_live"
        ? "You will be notified when iCapOS billing goes live."
        : requestType === "contact_sales"
          ? "Sales request received. Our team will follow up shortly."
          : "Upgrade request received. Billing activation will be handled when checkout is enabled.";

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit upgrade request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
