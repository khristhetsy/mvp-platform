import { NextResponse } from "next/server";
import { stripe, PLAN_PRICE_IDS } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { planType } = body as { planType?: string };

  if (!planType) {
    return NextResponse.json({ error: "planType is required." }, { status: 400 });
  }

  const priceId = PLAN_PRICE_IDS[planType];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid or unpaid plan." }, { status: 400 });
  }

  // Get existing Stripe customer ID if any
  const subscription = await getSubscriptionForProfile(user.id);
  const existingCustomerId = (subscription as Record<string, unknown> | null)?.stripe_customer_id as string | undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", user.id)
    .single();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: existingCustomerId,
    customer_email: existingCustomerId ? undefined : (profile?.email ?? user.email),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/billing?session_id={CHECKOUT_SESSION_ID}&success=1`,
    cancel_url: `${APP_URL}/billing?canceled=1`,
    metadata: {
      profile_id: user.id,
      plan_type: planType,
    },
    subscription_data: {
      metadata: {
        profile_id: user.id,
        plan_type: planType,
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
