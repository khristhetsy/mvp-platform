/**
 * LemonSqueezy API client.
 * Docs: https://docs.lemonsqueezy.com/api
 *
 * Required env vars:
 *   LEMONSQUEEZY_API_KEY
 *   LEMONSQUEEZY_STORE_ID
 *   LEMONSQUEEZY_WEBHOOK_SECRET
 *   LEMONSQUEEZY_VARIANT_ID_BASIC
 *   LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL
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

/**
 * Resolve the store id. Prefers LEMONSQUEEZY_STORE_ID if set; otherwise looks it
 * up from the API key's own store (always the correct store for the key's mode),
 * so operators don't have to find/set it manually.
 */
async function resolveStoreId(): Promise<string | null> {
  const fromEnv = process.env.LEMONSQUEEZY_STORE_ID?.trim();
  if (fromEnv) return fromEnv;
  const res = await fetch(`${LS_API}/stores`, { headers: headers() });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return json.data?.[0]?.id ?? null;
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function createCheckoutUrl({
  variantId,
  email,
  profileId,
  successUrl,
}: {
  variantId: string;
  email: string;
  profileId: string;
  successUrl: string;
}): Promise<string> {
  const storeId = await resolveStoreId();
  if (!storeId) throw new Error("Could not resolve a Lemon Squeezy store for this API key (check the key / mode).");

  const res = await fetch(`${LS_API}/checkouts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_options: { embed: false, media: false, logo: true },
          checkout_data: {
            email,
            custom: { profile_id: profileId },
          },
          product_options: {
            redirect_url: successUrl,
          },
        },
        relationships: {
          store:   { data: { type: "stores",   id: String(storeId) } },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LemonSqueezy checkout error ${res.status}: ${body}`);
  }

  const json = await res.json() as { data: { attributes: { url: string } } };
  return json.data.attributes.url;
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

// ─── Payment method (credit info) ─────────────────────────────────────────────

export interface LsPayment {
  cardBrand: string | null;      // "visa" | "mastercard" | …
  cardLastFour: string | null;   // "4242"
  updatePaymentUrl: string | null; // LS-hosted "update card" link
}

/** Card brand + last four for a subscription. Never returns a full card number. */
export async function getSubscriptionPayment(lsSubscriptionId: string): Promise<LsPayment | null> {
  if (!process.env.LEMONSQUEEZY_API_KEY || !lsSubscriptionId) return null;
  try {
    const res = await fetch(`${LS_API}/subscriptions/${lsSubscriptionId}`, { headers: headers() });
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await res.json()) as { data?: { attributes?: any } };
    const a = json.data?.attributes ?? {};
    return {
      cardBrand: a.card_brand ?? null,
      cardLastFour: a.card_last_four ?? null,
      updatePaymentUrl: a.urls?.update_payment_method ?? null,
    };
  } catch {
    return null;
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
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
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
    custom_data?: { profile_id?: string };
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
