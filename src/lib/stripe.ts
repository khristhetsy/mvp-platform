import "server-only";
import Stripe from "stripe";

/**
 * Stripe client and the few calls iCapOS makes. Server only: the secret key must
 * never reach a client component.
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_BASIC,
 * STRIPE_PRICE_PROFESSIONAL, STRIPE_PRICE_PREMIUM, and the legacy prices
 * STRIPE_PRICE_BASIC_LEGACY and STRIPE_PRICE_PREMIUM_LEGACY. See stripe-mapping.ts.
 */

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  if (!client) client = new Stripe(key);
  return client;
}

export function verifyStripeEvent(rawBody: string, signature: string): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return null;
  try {
    return getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

export type StripeCheckoutInput = {
  priceId: string;
  /** The signed in founder. Null for a guest who pays before any login exists. */
  profileId: string | null;
  /** The paid_signups row of a guest. The webhook reads it to find the row. */
  signupId?: string | null;
  planType: string;
  email: string | null;
  /** An existing Stripe customer, so a returning subscriber keeps one customer record. */
  customerId: string | null;
  successUrl: string;
  cancelUrl: string;
  managedPayments: boolean;
  /** The Lemon Squeezy subscription this one replaces. Cancelled once payment succeeds. */
  replacesLsSubscriptionId: string | null;
  /**
   * Unix seconds of the first Stripe charge. A subscriber moving from Lemon Squeezy
   * has already paid it for the current period, so Stripe starts charging when that
   * period ends. The subscription is active at once and nothing is charged today.
   */
  billingCycleAnchor?: number | null;
};

/** A hosted Checkout Session for a monthly subscription. Returns the page URL. */
export async function createStripeCheckoutUrl(input: StripeCheckoutInput): Promise<string> {
  const metadata: Record<string, string> = { plan_type: input.planType };
  if (input.profileId) metadata.profile_id = input.profileId;
  if (input.signupId) metadata.paid_signup_id = input.signupId;
  if (input.replacesLsSubscriptionId) metadata.replaces_ls_subscription_id = input.replacesLsSubscriptionId;

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    client_reference_id: input.profileId ?? input.signupId ?? undefined,
    ...(input.customerId ? { customer: input.customerId } : input.email ? { customer_email: input.email } : {}),
    managed_payments: { enabled: input.managedPayments },
    metadata,
    subscription_data: {
      metadata,
      ...(input.billingCycleAnchor ? { billing_cycle_anchor: input.billingCycleAnchor, proration_behavior: "none" as const } : {}),
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

/** Stripe's hosted billing portal: card, invoices, cancel. */
export async function createStripePortalUrl(customerId: string, returnUrl: string, updateCard = false): Promise<string> {
  const portal = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    ...(updateCard ? { flow_data: { type: "payment_method_update" as const } } : {}),
  });
  return portal.url;
}

/** Cancel at the end of the paid period. The customer keeps access until then. */
export async function stripeCancelAtPeriodEnd(subscriptionId: string): Promise<void> {
  await getStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

/** Undo a cancellation that has not reached its end date yet. */
export async function stripeResume(subscriptionId: string): Promise<void> {
  await getStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: false });
}

/** Move a subscription to another price at the next renewal, with no proration. */
export async function stripeChangePrice(subscriptionId: string, priceId: string): Promise<void> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item) throw new Error(`Stripe subscription ${subscriptionId} has no items.`);
  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price: priceId }],
    proration_behavior: "none",
  });
}
