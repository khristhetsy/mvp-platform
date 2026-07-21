import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, type LsWebhookPayload } from "@/lib/lemonsqueezy";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mapStatus, variantToPlan } from "@/lib/billing/webhook-mapping";
import { PLAN_PRICES } from "@/lib/subscriptions/plans";

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

  let query = admin.from("subscriptions").select("id, profile_id");
  if (lsSubId) {
    query = query.eq("ls_subscription_id", lsSubId);
  } else if (profileId) {
    query = query.eq("profile_id", profileId);
  } else {
    console.warn(`[billing/webhook] ${event_name}: no subscription id or profile_id — ignoring.`);
    return NextResponse.json({ received: true, ignored: "no identifier" });
  }

  const { data: existing, error: lookupError } = (await query.maybeSingle()) as {
    data: { id: string; profile_id: string } | null;
    error: { message: string } | null;
  };
  if (lookupError) {
    console.error(`[billing/webhook] ${event_name}: subscription lookup failed — ${lookupError.message}`);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  const { plan, source } = variantToPlan(attributes.variant_id, attributes.variant_name, attributes.product_name);
  const mapped = mapStatus(attributes.status);

  // An unrecognised LemonSqueezy status must not silently cancel a customer.
  // Fail the delivery so it retries and shows up as a failing webhook.
  if (mapped.unknown) {
    console.error(
      `[billing/webhook] ${event_name}: unrecognised LemonSqueezy status "${attributes.status}" for subscription ${lsSubId}. No change written.`,
    );
    return NextResponse.json({ error: "Unrecognised subscription status" }, { status: 500 });
  }

  if (source === "name") {
    console.warn(
      `[billing/webhook] ${event_name}: plan resolved from product name, not variant id (variant ${attributes.variant_id}). Set LEMONSQUEEZY_VARIANT_ID_BASIC / _PROFESSIONAL — renaming the product in LemonSqueezy will silently break this.`,
    );
  }

  const now = new Date().toISOString();
  const patch = {
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
    updated_at: now,
  };

  if (existing) {
    const { error } = await admin.from("subscriptions").update(patch).eq("id", existing.id);
    if (error) {
      console.error(
        `[billing/webhook] ${event_name}: failed to update subscription ${existing.id} — ${error.message}`,
      );
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    return NextResponse.json({ received: true, updated: existing.id });
  }

  if (profileId) {
    if (!plan) {
      // Creating a subscription with no plan but a hardcoded price is how a
      // $1,000 customer got recorded at $499. Refuse and retry instead.
      console.error(
        `[billing/webhook] ${event_name}: cannot create a subscription for profile ${profileId} — variant ${attributes.variant_id} (${attributes.product_name ?? "?"} / ${attributes.variant_name ?? "?"}) does not map to a known plan.`,
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
      console.error(
        `[billing/webhook] ${event_name}: failed to create subscription for profile ${profileId} — ${error.message}`,
      );
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }
    return NextResponse.json({ received: true, created: profileId });
  }

  console.warn(`[billing/webhook] ${event_name}: no existing subscription and no profile_id — nothing written.`);
  return NextResponse.json({ received: true, ignored: "no target" });
}
