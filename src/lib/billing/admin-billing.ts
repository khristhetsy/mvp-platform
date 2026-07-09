// Admin billing module — read model over the locally-synced `subscriptions` table
// (kept current by the Lemon Squeezy webhook) joined to profiles, plus per-customer
// invoices fetched live from Lemon Squeezy. Read-only: charging/refunds live in LS.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { listSubscriptionInvoices, getSubscriptionPayment, type LsInvoice, type LsPayment } from "@/lib/lemonsqueezy";
import { PLAN_LABELS, PLAN_PRICES, type PlanType } from "@/lib/subscriptions/plans";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

const ACTIVE = new Set(["active"]);
const TRIAL = new Set(["trialing"]);

export interface BillingCustomer {
  profileId: string;
  name: string;
  email: string;
  planType: string;
  planLabel: string;
  status: string;
  priceCents: number;
  currency: string;
  currentPeriodEnd: string | null;
  lsCustomerId: string | null;
  lsSubscriptionId: string | null;
  updatedAt: string | null;
}

export interface BillingStats {
  mrrCents: number;
  activeCount: number;
  trialCount: number;
  pendingUpgrades: number;
}

export interface WebhookHealth { configured: boolean; lastSyncAt: string | null }

function planLabel(pt: string | null): string {
  return pt && pt in PLAN_LABELS ? PLAN_LABELS[pt as PlanType] : (pt ?? "—");
}
function priceOf(pt: string | null, monthly: number | null): number {
  if (typeof monthly === "number" && monthly > 0) return monthly;
  return pt && pt in PLAN_PRICES ? PLAN_PRICES[pt as PlanType] : 0;
}

/** All billing customers (subscriptions + profile identity), newest activity first. */
export async function listBillingCustomers(): Promise<BillingCustomer[]> {
  const { data: subs } = await db()
    .from("subscriptions")
    .select("profile_id, plan_type, subscription_status, monthly_price_cents, currency, current_period_end, ls_customer_id, ls_subscription_id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = (subs ?? []) as Array<Record<string, unknown>>;
  const ids = [...new Set(rows.map((r) => String(r.profile_id)).filter(Boolean))];
  const nameById = new Map<string, { name: string; email: string }>();
  if (ids.length) {
    const { data: people } = await db().from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (people ?? []) as Array<Record<string, unknown>>) {
      nameById.set(String(p.id), { name: (p.full_name as string) ?? (p.email as string) ?? "—", email: (p.email as string) ?? "—" });
    }
  }

  return rows.map((r) => {
    const pt = (r.plan_type as string) ?? null;
    const who = nameById.get(String(r.profile_id)) ?? { name: "—", email: "—" };
    return {
      profileId: String(r.profile_id),
      name: who.name,
      email: who.email,
      planType: pt ?? "—",
      planLabel: planLabel(pt),
      status: (r.subscription_status as string) ?? "—",
      priceCents: priceOf(pt, r.monthly_price_cents as number | null),
      currency: (r.currency as string) ?? "USD",
      currentPeriodEnd: (r.current_period_end as string) ?? null,
      lsCustomerId: (r.ls_customer_id as string) ?? null,
      lsSubscriptionId: (r.ls_subscription_id as string) ?? null,
      updatedAt: (r.updated_at as string) ?? null,
    };
  });
}

export async function getBillingStats(customers: BillingCustomer[]): Promise<BillingStats> {
  const mrrCents = customers.filter((c) => ACTIVE.has(c.status)).reduce((a, c) => a + c.priceCents, 0);
  const activeCount = customers.filter((c) => ACTIVE.has(c.status)).length;
  const trialCount = customers.filter((c) => TRIAL.has(c.status)).length;
  let pendingUpgrades = 0;
  try {
    const { count } = await db().from("upgrade_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
    pendingUpgrades = count ?? 0;
  } catch { /* best-effort */ }
  return { mrrCents, activeCount, trialCount, pendingUpgrades };
}

export async function getWebhookHealth(customers: BillingCustomer[]): Promise<WebhookHealth> {
  const lastSyncAt = customers.map((c) => c.updatedAt).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null;
  return { configured: Boolean(process.env.LEMONSQUEEZY_WEBHOOK_SECRET), lastSyncAt };
}

export interface BillingCustomerDetail {
  customer: BillingCustomer | null;
  invoices: LsInvoice[];
  payment: LsPayment | null;
  statement: { invoicedCents: number; paidCents: number; dueCents: number; currency: string };
}

export async function getBillingCustomerDetail(profileId: string): Promise<BillingCustomerDetail> {
  const customers = await listBillingCustomers();
  const customer = customers.find((c) => c.profileId === profileId) ?? null;
  const [invoices, payment] = customer?.lsSubscriptionId
    ? await Promise.all([listSubscriptionInvoices(customer.lsSubscriptionId), getSubscriptionPayment(customer.lsSubscriptionId)])
    : [[], null];

  const invoicedCents = invoices.reduce((a, i) => a + i.total, 0);
  const paidCents = invoices.filter((i) => i.status === "paid" && !i.refunded).reduce((a, i) => a + i.total, 0);
  const dueCents = invoices.filter((i) => i.status === "pending").reduce((a, i) => a + i.total, 0);
  const currency = invoices[0]?.currency ?? customer?.currency ?? "USD";

  return { customer, invoices, payment, statement: { invoicedCents, paidCents, dueCents, currency } };
}
