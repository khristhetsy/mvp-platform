import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, type LsWebhookPayload, type LsSubscriptionStatus } from "@/lib/lemonsqueezy";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SubscriptionStatus, PlanType } from "@/lib/subscriptions/plans";

// Map LemonSqueezy status → internal status
function mapStatus(ls: LsSubscriptionStatus): SubscriptionStatus {
  switch (ls) {
    case "active":
    case "past_due": return "active";
    case "on_trial": return "trialing";
    case "cancelled":
    case "paused":
    case "unpaid":
    case "expired":
    default: return "canceled";
  }
}

// Map LS variant ID → plan type
function variantToPlan(variantId: number): PlanType | null {
  const basic = process.env.LEMONSQUEEZY_VARIANT_ID_BASIC;
  const pro   = process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL;
  if (basic && String(variantId) === basic)   return "founder_basic";
  if (pro   && String(variantId) === pro)     return "founder_professional";
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody  = await req.text();
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
  const { id: lsSubId, attributes }  = payload.data;
  const profileId = custom_data?.profile_id;

  // We need either a profileId (from checkout custom_data) or an existing subscription record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any;

  // Find existing subscription row by ls_subscription_id or profile_id
  let query = admin.from("subscriptions").select("id, profile_id");
  if (lsSubId) {
    query = query.eq("ls_subscription_id", lsSubId);
  } else if (profileId) {
    query = query.eq("profile_id", profileId);
  } else {
    return NextResponse.json({ received: true });
  }

  const { data: existing } = await query.maybeSingle() as { data: { id: string; profile_id: string } | null };

  const planType  = variantToPlan(attributes.variant_id);
  const status    = mapStatus(attributes.status);
  const now       = new Date().toISOString();

  const patch = {
    ls_subscription_id:   lsSubId,
    ls_customer_id:       String(attributes.customer_id),
    ls_variant_id:        String(attributes.variant_id),
    subscription_status:  status,
    plan_type:            planType ?? undefined,
    current_period_start: now,
    current_period_end:   attributes.renews_at ?? attributes.ends_at ?? null,
    updated_at:           now,
  };

  if (existing) {
    await admin.from("subscriptions").update(patch).eq("id", existing.id);
  } else if (profileId) {
    // subscription_created for a new customer — upsert
    await admin.from("subscriptions").upsert(
      {
        ...patch,
        profile_id:          profileId,
        role:                "founder",
        monthly_price_cents: planType === "founder_professional" ? 100000 : 50000,
        currency:            "USD",
      },
      { onConflict: "profile_id" }
    );
  }

  return NextResponse.json({ received: true });
}
