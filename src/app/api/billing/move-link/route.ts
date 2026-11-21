import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkFormRateLimit } from "@/lib/ai-site/ratelimit";
import { verifyMoveLinkToken } from "@/lib/billing/move-link-core";
import { createAdminCheckoutUrl, describeMove, type AdminCheckoutInput } from "@/lib/billing/admin-checkout";
import { isStripePlan } from "@/lib/billing/stripe-mapping";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

/**
 * POST: the customer clicked "Continue to Stripe" on the move page. Creates a fresh Stripe
 * checkout for the move (their old price kept, first charge on their Lemon Squeezy renewal date)
 * and returns its URL. Only a live Lemon Squeezy card subscription can move, and the token names
 * the profile, so the link cannot be pointed at anything else.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limited = await checkFormRateLimit({ scope: "billing_move_link", ip, limit: 20 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const profileId = verifyMoveLinkToken(typeof body?.token === "string" ? body.token : null);
  if (!profileId) return NextResponse.json({ error: "This link is not valid. Please ask iCFO for a new one." }, { status: 401 });

  try {
    const admin = loose(createServiceRoleClient());
    const { data: profile } = await admin.from("profiles").select("email").eq("id", profileId).maybeSingle();
    const email = (profile as { email: string | null } | null)?.email ?? null;
    const { data: subRaw } = await admin
      .from("subscriptions")
      .select("plan_type, subscription_status, ls_subscription_id, ls_variant_id, stripe_subscription_id, stripe_customer_id, cancel_at_period_end, grace_period_ends_at, current_period_end")
      .eq("profile_id", profileId)
      .maybeSingle();
    const subscription = (subRaw ?? null) as AdminCheckoutInput["subscription"];
    const plan = subscription?.plan_type;
    if (!email || !subscription || !isStripePlan(plan)) {
      return NextResponse.json({ error: "This link is no longer active. Please ask iCFO for a new one." }, { status: 410 });
    }
    if (subscription.stripe_subscription_id) {
      return NextResponse.json({ error: "Your card is already on file at Stripe." }, { status: 409 });
    }
    if (!describeMove(subscription, plan).moving) {
      return NextResponse.json({ error: "This link is no longer active. Please ask iCFO for a new one." }, { status: 410 });
    }
    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";
    const url = await createAdminCheckoutUrl({ plan, email, profileId, successUrl: `${origin}/billing`, subscription });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[billing/move-link]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
