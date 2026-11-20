import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkFormRateLimit } from "@/lib/ai-site/ratelimit";
import { isPaymentsEnabled } from "@/lib/billing/pricing-guard";
import { createPaidSignup, emailHasAccount, guestCheckoutUrl } from "@/lib/billing/paid-signup";
import { createStripeCheckoutUrl, stripeConfigured } from "@/lib/stripe";
import { managedPaymentsFor, stripePriceId } from "@/lib/billing/stripe-mapping";
import { PAID_SIGNUP_CLAIM_DAYS, PAID_SIGNUP_COOKIE, makePaidSignupToken } from "@/lib/billing/paid-signup-core";
import { AGREEMENT_VERSION, parseAgreementInput } from "@/lib/billing/premium-agreement-core";
import { recordFunnelEvent } from "@/lib/analytics/funnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(320),
  planType: z.enum(["founder_basic", "founder_professional", "founder_premium"]),
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  refundPolicyAcceptedAt: z.string().min(1).max(64),
  refundPolicyVersion: z.string().max(80).optional(),
  /** Premium only: the Services Agreement fields and the check mark. */
  agreement: z.record(z.string(), z.unknown()).optional(),
  agree: z.boolean().optional(),
});

/**
 * Checkout for someone who has no login yet (pay first, account after). Records the
 * billing terms they accepted, then returns the Stripe Checkout link (Lemon Squeezy
 * only when Stripe is not configured). The order carries the paid signup id, which
 * the payment webhook uses to find the row. A guest has never paid, so they always
 * pay the current price, never a legacy one.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isPaymentsEnabled()) {
    return NextResponse.json({ error: "Online checkout is not available yet. Please contact us to start your plan." }, { status: 503 });
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const limited = await checkFormRateLimit({ scope: "guest_checkout", ip, limit: 10 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please accept the billing terms to continue." }, { status: 400 });
  }
  const input = parsed.data;

  // Premium carries the iCFO Services Agreement. It is checked here, before any payment,
  // and kept on the signup so it is recorded against the account when the login is created.
  let premiumAgreement: Parameters<typeof createPaidSignup>[0]["premiumAgreement"] = null;
  if (input.planType === "founder_premium") {
    if (input.agree !== true) return NextResponse.json({ error: "Please check the box to accept the Services Agreement." }, { status: 400 });
    const agreement = parseAgreementInput(input.agreement);
    if (!agreement.ok) return NextResponse.json({ error: agreement.error }, { status: 400 });
    premiumAgreement = { ...agreement.value, acceptedAt: new Date().toISOString(), version: AGREEMENT_VERSION, userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null };
  }

  try {
    if (await emailHasAccount(input.email)) {
      return NextResponse.json(
        { error: "You already have an iCapOS account with this email. Please sign in, then choose your plan from your billing page.", code: "account_exists" },
        { status: 409 },
      );
    }
    const signupId = await createPaidSignup({
      email: input.email,
      plan: input.planType,
      name: input.name,
      company: input.company,
      consentAcceptedAt: input.refundPolicyAcceptedAt,
      policyVersion: input.refundPolicyVersion,
      userAgent: req.headers.get("user-agent"),
      premiumAgreement,
    });
    let url: string | null;
    if (stripeConfigured()) {
      const priceId = stripePriceId(input.planType, "current");
      if (!priceId) {
        console.error(`[billing/guest-checkout] Stripe current price for ${input.planType} is not configured`);
        url = null;
      } else {
        const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com";
        url = await createStripeCheckoutUrl({
          priceId,
          profileId: null,
          signupId,
          planType: input.planType,
          email: input.email.trim().toLowerCase(),
          customerId: null,
          successUrl: `${origin}/start/paid`,
          cancelUrl: `${origin}/start/pay?email=${encodeURIComponent(input.email)}&plan=${input.planType}`,
          managedPayments: managedPaymentsFor(input.planType),
          replacesLsSubscriptionId: null,
        });
      }
    } else {
      url = guestCheckoutUrl({ plan: input.planType, email: input.email, name: input.name, signupId });
    }
    if (!url) {
      return NextResponse.json({ error: "Online checkout is not available for this plan yet. Please contact us." }, { status: 503 });
    }
    await recordFunnelEvent({ sessionId: `guest_checkout_${signupId}`, eventName: "checkout_start", properties: { plan: input.planType, guest: true } });

    const res = NextResponse.json({ url });
    // Lets the payment page find this signup when they come back from checkout in the same browser.
    res.cookies.set(PAID_SIGNUP_COOKIE, makePaidSignupToken(signupId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PAID_SIGNUP_CLAIM_DAYS * 24 * 60 * 60,
    });
    return res;
  } catch (err) {
    console.error("[billing/guest-checkout]", err);
    return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}
