/**
 * The pricing catalogue — one source of truth for what a plan costs and how that
 * price is written, everywhere.
 *
 * Before this, a price lived in five places that had to be edited together:
 * PLAN_PRICES (cents), priceLabel strings in plans.ts, a second card array in
 * billing/pricing.ts, the public page copy in content/pricing.ts, and two AI
 * prompts. They drifted, which is how /upgrade ended up still quoting $499.
 *
 * Labels are DERIVED from cents unless a plan needs words instead of a number
 * ("Pricing on request"), so a price change can't leave a stale label behind.
 *
 * Pure and DB-free — the loader lives in pricing-server.ts.
 */
import {
  ADDITIONAL_COMPANY_PRICE, MANAGED_IR_MIN_MONTHS, PLAN_PRICES,
  SIGNUP_FOUNDER_PLANS, type PlanType, type SignupPlanOption,
} from "@/lib/subscriptions/plans";

/** Plans that carry a price a human ever reads. */
export const PRICED_PLANS = ["founder_free", "founder_basic", "founder_professional", "founder_managed_ir"] as const;
export type PricedPlanKey = (typeof PRICED_PLANS)[number];

export type PricedPlan = {
  cents: number;
  /** Shown instead of the derived amount — only for sales-led tiers. */
  label?: string | null;
  sublabel?: string | null;
  contactSales?: boolean;
};

export type PricingCatalog = {
  id: string | null;
  version: string;
  plans: Record<PricedPlanKey, PricedPlan>;
  addCompanyCents: number;
  managedIrMinMonths: number;
  existingPolicy: "grandfather" | "migrate";
  effectiveAt: string | null;
  reason: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string | null;
};

/** Today's constants — the seed row, and the fallback when the table is unreachable. */
export const CODE_DEFAULT_PRICING: PricingCatalog = {
  id: null,
  version: "pricing-v1",
  plans: {
    founder_free: { cents: PLAN_PRICES.founder_free, label: "$0", sublabel: "Readiness" },
    founder_basic: { cents: PLAN_PRICES.founder_basic, sublabel: "/month" },
    founder_professional: { cents: PLAN_PRICES.founder_professional, sublabel: "/month" },
    founder_managed_ir: { cents: PLAN_PRICES.founder_managed_ir, label: "Pricing on request", sublabel: "3-month minimum", contactSales: true },
  },
  addCompanyCents: ADDITIONAL_COMPANY_PRICE,
  managedIrMinMonths: MANAGED_IR_MIN_MONTHS,
  existingPolicy: "grandfather",
  effectiveAt: null,
  reason: "Code defaults",
  isActive: true,
  createdBy: null,
  createdAt: null,
};

// ── Formatting ───────────────────────────────────────────────────────────────

/** 4900 → "$49"; 350000 → "$3,500"; 4950 → "$49.50". */
export function money(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export const isPriced = (plan: string): plan is PricedPlanKey => (PRICED_PLANS as readonly string[]).includes(plan);

/** What to print for a plan: its words if it has them, otherwise the amount. */
export function priceLabel(catalog: PricingCatalog, plan: PlanType | PricedPlanKey): string {
  if (!isPriced(plan)) return money(PLAN_PRICES[plan as PlanType] ?? 0);
  const p = catalog.plans[plan];
  return p?.label?.trim() ? p.label : money(p?.cents ?? 0);
}
export function priceSublabel(catalog: PricingCatalog, plan: PlanType | PricedPlanKey): string {
  if (!isPriced(plan)) return "/month";
  return catalog.plans[plan]?.sublabel ?? "/month";
}
/** "$199/mo" — the compact form used in dropdowns, chips and CTA buttons. */
export function priceShort(catalog: PricingCatalog, plan: PlanType | PricedPlanKey): string {
  if (isPriced(plan) && catalog.plans[plan]?.label?.trim()) return catalog.plans[plan].label as string;
  return `${money(centsFor(catalog, plan))}/mo`;
}
export function centsFor(catalog: PricingCatalog, plan: PlanType | PricedPlanKey): number {
  if (isPriced(plan)) return catalog.plans[plan]?.cents ?? 0;
  return PLAN_PRICES[plan as PlanType] ?? 0;
}
export const addCompanyLabel = (catalog: PricingCatalog) => `${money(catalog.addCompanyCents)}/mo`;

// ── Validation ───────────────────────────────────────────────────────────────

export type PricingDraft = { plans: Record<PricedPlanKey, PricedPlan>; addCompanyCents: number };

export function validatePricing(draft: PricingDraft): string[] {
  const errors: string[] = [];
  const cents = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 100_000_00;
  for (const key of PRICED_PLANS) {
    const p = draft.plans[key];
    if (!p) { errors.push(`${key} is missing.`); continue; }
    if (!cents(p.cents)) errors.push(`${key}: the price must be a whole number of cents between $0 and $100,000.`);
    if (p.label && p.label.length > 40) errors.push(`${key}: the label is too long.`);
    if (p.sublabel && p.sublabel.length > 40) errors.push(`${key}: the sub-label is too long.`);
  }
  if (draft.plans.founder_free?.cents !== 0) errors.push("The free plan must cost $0.");
  if (!cents(draft.addCompanyCents)) errors.push("Additional company: the price must be a whole number of cents.");
  return errors;
}

// ── Diff ─────────────────────────────────────────────────────────────────────

export type PriceDiffRow = { plan: string; field: "price" | "label" | "sub-label"; before: string; after: string };

export function diffPricing(a: PricingCatalog, b: PricingCatalog): PriceDiffRow[] {
  const rows: PriceDiffRow[] = [];
  for (const key of PRICED_PLANS) {
    const x = a.plans[key] ?? { cents: 0 }, y = b.plans[key] ?? { cents: 0 };
    if (x.cents !== y.cents) rows.push({ plan: key, field: "price", before: money(x.cents), after: money(y.cents) });
    if ((x.label ?? "") !== (y.label ?? "")) rows.push({ plan: key, field: "label", before: x.label || "(derived)", after: y.label || "(derived)" });
    if ((x.sublabel ?? "") !== (y.sublabel ?? "")) rows.push({ plan: key, field: "sub-label", before: x.sublabel || "—", after: y.sublabel || "—" });
  }
  if (a.addCompanyCents !== b.addCompanyCents) rows.push({ plan: "additional_company", field: "price", before: money(a.addCompanyCents), after: money(b.addCompanyCents) });
  return rows;
}

export function summarizePricingDiff(rows: PriceDiffRow[]): string {
  if (!rows.length) return "No change";
  return rows.filter((r) => r.field === "price").map((r) => `${PLAN_SHORT[r.plan] ?? r.plan} ${r.before} → ${r.after}`).join(" · ")
    || `${rows.length} label change${rows.length === 1 ? "" : "s"}`;
}

export const PLAN_SHORT: Record<string, string> = {
  founder_free: "Free",
  founder_basic: "Basic",
  founder_professional: "Professional",
  founder_managed_ir: "SPV Program",
  additional_company: "Additional company",
};

/** pricing-v1 → pricing-v2, skipping names already used. */
export function nextPricingVersion(current: string, taken: string[]): string {
  const m = /^(.*?)(\d+)$/.exec(current);
  const stem = m ? m[1] : `${current}-v`;
  let n = m ? Number(m[2]) + 1 : 2;
  while (taken.includes(`${stem}${n}`)) n++;
  return `${stem}${n}`;
}

// ── Row mapping ──────────────────────────────────────────────────────────────

export type PricingSetRow = {
  id: string; version: string; plans: unknown; add_company_cents: number; reason: string | null;
  existing_policy: string; effective_at: string; is_active: boolean; created_by: string | null; created_at: string;
};

export function pricingFromRow(row: PricingSetRow): PricingCatalog {
  const plans = { ...CODE_DEFAULT_PRICING.plans, ...((row.plans ?? {}) as Record<PricedPlanKey, PricedPlan>) };
  return {
    id: row.id,
    version: row.version,
    plans,
    addCompanyCents: row.add_company_cents ?? CODE_DEFAULT_PRICING.addCompanyCents,
    managedIrMinMonths: MANAGED_IR_MIN_MONTHS,
    existingPolicy: row.existing_policy === "migrate" ? "migrate" : "grandfather",
    effectiveAt: row.effective_at,
    reason: row.reason,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// ── Where it shows ───────────────────────────────────────────────────────────

/**
 * Every place a price reaches a human. `follows` rows read this catalogue;
 * `flagged` rows are copy a person writes that the editor can only point at.
 * Kept here, next to the catalogue, so adding a price surface means adding a row.
 */
export type PriceSurface = {
  where: string;
  audience: string;
  renders: string;
  status: "follows" | "flagged" | "provider";
  note?: string;
};

export function priceSurfaces(catalog: PricingCatalog): PriceSurface[] {
  const pair = `${priceLabel(catalog, "founder_basic")} · ${priceLabel(catalog, "founder_professional")}`;
  return [
    { where: "Signup plan picker", audience: "Public", renders: `${pair} /month`, status: "follows" },
    { where: "Checkout confirm dialog", audience: "Public", renders: pair, status: "follows" },
    { where: "Upgrade page plan grid", audience: "Founder", renders: `${pair} /month`, status: "follows" },
    { where: "Public pricing page + SEO + JSON-LD", audience: "Public", renders: pair, status: "follows" },
    { where: "Upgrade & Billing CTA buttons", audience: "Founder", renders: `Founder Basic — ${priceShort(catalog, "founder_basic")}`, status: "follows" },
    { where: "Admin billing · plan dropdown", audience: "Staff", renders: pair, status: "follows" },
    { where: "Outreach Qualification · plan caps", audience: "Staff", renders: pair, status: "follows" },
    { where: "“Add a company” refusal message", audience: "Founder", renders: addCompanyLabel(catalog), status: "follows" },
    { where: "Site AI + support assistant prompts", audience: "Public / Founder", renders: pair, status: "follows" },
    { where: "MRR · campaign ROI · social funnel revenue", audience: "Staff", renders: "computed from price", status: "follows", note: "New rows only — history keeps what was billed." },
    { where: "Sales forecast ARPU", audience: "Staff", renders: "scenario assumption", status: "flagged", note: "An assumption you tune per scenario — edit it in Forecast." },
    { where: "Page-builder pricing blocks", audience: "Public", renders: "free text on published pages", status: "flagged", note: "Written per page; listed here, never rewritten." },
    { where: "LemonSqueezy receipts & invoices", audience: "Customer", renders: "the real charge", status: "provider", note: "Set in their dashboard." },
  ];
}

/** The signup plan cards with the active prices laid over their copy. */
export function signupFounderPlans(catalog: PricingCatalog): SignupPlanOption[] {
  return SIGNUP_FOUNDER_PLANS.map((card) =>
    isPriced(card.planType)
      ? { ...card, priceLabel: priceLabel(catalog, card.planType), priceSubtext: priceSublabel(catalog, card.planType) }
      : card,
  );
}
