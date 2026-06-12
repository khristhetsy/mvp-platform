import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function statusFromStripe(status: string): string {
  switch (status) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "canceled":
    case "unpaid":
    case "incomplete_expired": return "canceled";
    default: return "active";
  }
}

// Use unknown + cast to avoid Stripe SDK type mismatches across API versions
function getSubFields(sub: unknown) {
  const s = sub as Record<string, unknown>;
  const items = s.items as { data: Array<Record<string, unknown>> };
  const item = items.data[0] ?? {};
  const price = (item.price ?? {}) as Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);
  return {
    customerId: s.customer as string,
    subscriptionId: s.id as string,
    status: s.status as string,
    priceId: price.id as string,
    unitAmount: (price.unit_amount as number) ?? 0,
    periodStart: (s.current_period_start as number) ?? now,
    periodEnd: (s.current_period_end as number) ?? now + 2592000,
    metadata: (s.metadata ?? {}) as Record<string, string>,
  };
}

async function upsertSubscription(
  profileId: string,
  planType: string,
  customerId: string,
  subscriptionId: string,
  priceId: string,
  status: string,
  periodStart: number,
  periodEnd: number,
  priceCents: number,
) {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("subscriptions") as any).upsert(
    {
      profile_id: profileId,
      role: planType.startsWith("investor") ? "investor" : "founder",
      plan_type: planType,
      subscription_status: status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      monthly_price_cents: priceCents,
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return NextResponse.json({ ok: true });

      const profileId = session.metadata?.profile_id;
      const planType = session.metadata?.plan_type;
      if (!profileId || !planType) return NextResponse.json({ ok: true });

      const rawSub = await stripe.subscriptions.retrieve(session.subscription as string);
      const f = getSubFields(rawSub);

      await upsertSubscription(
        profileId, planType, f.customerId, f.subscriptionId,
        f.priceId, statusFromStripe(f.status), f.periodStart, f.periodEnd, f.unitAmount,
      );
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const f = getSubFields(event.data.object);
      const profileId = f.metadata.profile_id;
      const planType = f.metadata.plan_type;
      if (!profileId || !planType) return NextResponse.json({ ok: true });

      const status = event.type === "customer.subscription.deleted"
        ? "canceled"
        : statusFromStripe(f.status);

      await upsertSubscription(
        profileId, planType, f.customerId, f.subscriptionId,
        f.priceId, status, f.periodStart, f.periodEnd, f.unitAmount,
      );
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
