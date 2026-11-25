/**
 * LemonSqueezy API client.
 * Docs: https://docs.lemonsqueezy.com/api
 *
 * For the subscriptions Lemon Squeezy already bills. It cannot create a checkout:
 * every new payment starts on Stripe (src/lib/stripe.ts).
 *
 * Env vars read here:
 *   LEMONSQUEEZY_API_KEY
 *   LEMONSQUEEZY_WEBHOOK_SECRET
 */

import crypto from "crypto";

const LS_API = "https://api.lemonsqueezy.com/v1";

function headers() {
  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
  };
}

// ─── Customer portal ──────────────────────────────────────────────────────────

export async function getCustomerPortalUrl(lsSubscriptionId: string): Promise<string> {
  const res = await fetch(`${LS_API}/subscriptions/${lsSubscriptionId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LemonSqueezy subscription fetch error ${res.status}: ${body}`);
  }

  const json = await res.json() as { data: { attributes: { urls: { customer_portal: string } } } };
  return json.data.attributes.urls.customer_portal;
}

/**
 * Link to Lemon Squeezy's hosted page where the customer enters a new card for one
 * subscription. The link is signed and short lived, so it is fetched on click, never
 * stored. Falls back to the customer portal if the update link is not returned.
 */
export async function getUpdatePaymentMethodUrl(lsSubscriptionId: string): Promise<string> {
  const res = await fetch(`${LS_API}/subscriptions/${encodeURIComponent(lsSubscriptionId)}`, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LemonSqueezy subscription fetch error ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { data: { attributes: { urls?: { update_payment_method?: string; customer_portal?: string } } } };
  const urls = json.data.attributes.urls ?? {};
  const url = urls.update_payment_method ?? urls.customer_portal;
  if (!url) throw new Error("LemonSqueezy returned no update link");
  return url;
}

// ─── Subscription management (stop payment, resume, plan change) ──────────────

export type LsSubscriptionDetails = {
  status: string;
  cancelled: boolean;
  endsAt: string | null;
  renewsAt: string | null;
  cardBrand: string | null;
  cardLastFour: string | null;
  portalUrl: string | null;
  /** The last charge failed (Lemon Squeezy status past_due or unpaid): the card needs updating. */
  paymentFailed: boolean;
};

/** Card on file and cancellation state for one subscription. Null on any error. */
export async function getSubscriptionDetails(lsSubscriptionId: string): Promise<LsSubscriptionDetails | null> {
  if (!process.env.LEMONSQUEEZY_API_KEY || !lsSubscriptionId) return null;
  try {
    const res = await fetch(`${LS_API}/subscriptions/${encodeURIComponent(lsSubscriptionId)}`, { headers: headers() });
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = ((await res.json()) as { data?: { attributes?: any } }).data?.attributes ?? {};
    return {
      status: String(a.status ?? ""),
      cancelled: Boolean(a.cancelled),
      endsAt: a.ends_at ?? null,
      renewsAt: a.renews_at ?? null,
      cardBrand: a.card_brand ?? null,
      cardLastFour: a.card_last_four ?? null,
      portalUrl: a.urls?.customer_portal ?? null,
      paymentFailed: a.status === "past_due" || a.status === "unpaid",
    };
  } catch {
    return null;
  }
}

export type LsCustomerDetails = { name: string | null; city: string | null; region: string | null; country: string | null };

/** Name and location Lemon Squeezy holds for a customer. The street address and tax ID are not exposed by the API. */
export async function getCustomerDetails(lsCustomerId: string): Promise<LsCustomerDetails | null> {
  if (!process.env.LEMONSQUEEZY_API_KEY || !lsCustomerId) return null;
  try {
    const res = await fetch(`${LS_API}/customers/${encodeURIComponent(lsCustomerId)}`, { headers: headers() });
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = ((await res.json()) as { data?: { attributes?: any } }).data?.attributes ?? {};
    return {
      name: a.name ?? null,
      city: a.city ?? null,
      region: a.region ?? null,
      country: a.country_formatted ?? a.country ?? null,
    };
  } catch {
    return null;
  }
}

async function patchSubscription(lsSubscriptionId: string, attributes: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${LS_API}/subscriptions/${encodeURIComponent(lsSubscriptionId)}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ data: { type: "subscriptions", id: String(lsSubscriptionId), attributes } }),
  });
  if (!res.ok) throw new Error(`LemonSqueezy subscription update error ${res.status}: ${await res.text()}`);
}

/** Cancel at the end of the paid period. The customer keeps access until `ends_at`. */
export async function cancelSubscription(lsSubscriptionId: string): Promise<void> {
  const res = await fetch(`${LS_API}/subscriptions/${encodeURIComponent(lsSubscriptionId)}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`LemonSqueezy cancel error ${res.status}: ${await res.text()}`);
}

/** Undo a cancellation that has not reached its end date yet. */
export async function resumeSubscription(lsSubscriptionId: string): Promise<void> {
  await patchSubscription(lsSubscriptionId, { cancelled: false });
}

/**
 * Move a subscription to another variant. Proration is off: the customer moves to
 * the new price at the next renewal with no extra charge. The change itself is
 * immediate on Lemon Squeezy's side.
 */
export async function changeSubscriptionVariant(lsSubscriptionId: string, variantId: string): Promise<void> {
  await patchSubscription(lsSubscriptionId, { variant_id: Number(variantId), disable_prorations: true });
}

// ─── Invoices (admin billing) ─────────────────────────────────────────────────

export interface LsInvoice {
  id: string;
  total: number;            // cents
  totalFormatted: string;   // e.g. "$1,000.00"
  currency: string;
  status: string;           // paid | pending | void | refunded
  refunded: boolean;
  createdAt: string;
  invoiceUrl: string | null; // hosted invoice / PDF
}

/** Invoices for one subscription, most recent first. Empty on any error/misconfig. */
export async function listSubscriptionInvoices(lsSubscriptionId: string): Promise<LsInvoice[]> {
  if (!process.env.LEMONSQUEEZY_API_KEY || !lsSubscriptionId) return [];
  try {
    const res = await fetch(
      `${LS_API}/subscription-invoices?filter[subscription_id]=${encodeURIComponent(lsSubscriptionId)}&page[size]=50`,
      { headers: headers() },
    );
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await res.json()) as { data?: Array<{ id: string; attributes: any }> };
    return (json.data ?? [])
      .map((r) => {
        const a = r.attributes ?? {};
        return {
          id: r.id,
          total: Number(a.total ?? 0),
          totalFormatted: String(a.total_formatted ?? ""),
          currency: String(a.currency ?? "USD"),
          status: String(a.status ?? ""),
          refunded: Boolean(a.refunded),
          createdAt: String(a.created_at ?? ""),
          invoiceUrl: a.urls?.invoice_url ?? null,
        };
      })
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  } catch {
    return [];
  }
}

// ─── Webhook verification ─────────────────────────────────────────────────────

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // timingSafeEqual throws on different lengths, which turned a bad or missing
  // signature into a 500 instead of a 401.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Webhook payload types ────────────────────────────────────────────────────

export type LsEventName =
  | "subscription_created"
  | "subscription_updated"
  | "subscription_cancelled"
  | "subscription_resumed"
  | "subscription_expired"
  | "subscription_paused"
  | "subscription_unpaused"
  | "order_created";

export type LsSubscriptionStatus =
  | "on_trial"
  | "active"
  | "paused"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "expired";

export interface LsWebhookPayload {
  meta: {
    event_name: LsEventName;
    custom_data?: { profile_id?: string; signup_id?: string };
  };
  data: {
    id: string;
    type: string;
    attributes: {
      status:              LsSubscriptionStatus;
      variant_id:          number;
      variant_name?:       string | null;
      product_name?:       string | null;
      customer_id:         number;
      user_email:          string;
      renews_at:           string | null;
      ends_at:             string | null;
      trial_ends_at:       string | null;
      current_period_end?: string | null;
    };
  };
}

// ─── Variant price (read-only) ───────────────────────────────────────────────

export type LsVariantPrice = { variantId: string; name: string | null; priceCents: number | null };

/**
 * What LemonSqueezy actually charges for a variant. Read-only on purpose: their
 * prices are immutable and can't be changed through the API, so the pricing admin
 * compares against this and warns rather than pretending it can write it.
 * Returns null when billing isn't configured or the variant can't be read.
 */
export async function getVariantPrice(variantId: string): Promise<LsVariantPrice | null> {
  if (!process.env.LEMONSQUEEZY_API_KEY || !variantId) return null;
  try {
    const res = await fetch(`${LS_API}/variants/${encodeURIComponent(variantId)}`, { headers: headers(), cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { attributes?: { name?: string; price?: number } } };
    const attrs = json.data?.attributes;
    if (!attrs) return null;
    return { variantId, name: attrs.name ?? null, priceCents: typeof attrs.price === "number" ? attrs.price : null };
  } catch {
    return null;
  }
}
