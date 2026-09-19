/**
 * The admin side of the pricing catalogue: saving a version, counting who is on
 * each plan, and asking LemonSqueezy what it actually charges.
 *
 * Saving never edits a row in place — it appends a version and flips the active
 * flag, so the history stays a record of what was true when.
 *
 * Server only.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getVariantPrice } from "@/lib/lemonsqueezy";
import {
  PRICED_PLANS, pricingFromRow, type PricedPlan, type PricedPlanKey,
  type PricingCatalog, type PricingSetRow,
} from "@/lib/subscriptions/pricing-catalog";

type Db = ReturnType<typeof createServiceRoleClient>;

const COLS = "id, version, plans, add_company_cents, reason, existing_policy, effective_at, is_active, created_by, created_at";

/** How many live subscriptions sit on each plan — the "who this moves" number. */
export async function planCounts(db: Db): Promise<Record<string, number>> {
  const { data } = await db
    .from("subscriptions")
    .select("plan_type, subscription_status")
    .in("subscription_status", ["active", "trialing", "past_due"]);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ plan_type: string | null }>) {
    const key = row.plan_type ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export type ProviderPrice = {
  plan: PricedPlanKey;
  variantId: string | null;
  priceCents: number | null;
  name: string | null;
  /** null when we can't tell (no variant configured, or the API is unreachable). */
  matches: boolean | null;
};

/**
 * What LemonSqueezy charges today, per plan. Their prices are immutable and not
 * writable through the API, so this is read-only — the screen warns, the
 * operator fixes it in their dashboard.
 */
export async function providerPrices(catalog: PricingCatalog): Promise<ProviderPrice[]> {
  const variants: Partial<Record<PricedPlanKey, string | undefined>> = {
    founder_basic: process.env.LEMONSQUEEZY_VARIANT_ID_BASIC,
    founder_professional: process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL,
  };
  return Promise.all(
    PRICED_PLANS.map(async (plan) => {
      const variantId = variants[plan]?.trim() || null;
      if (!variantId) return { plan, variantId: null, priceCents: null, name: null, matches: null };
      const live = await getVariantPrice(variantId);
      const priceCents = live?.priceCents ?? null;
      return {
        plan,
        variantId,
        priceCents,
        name: live?.name ?? null,
        matches: priceCents === null ? null : priceCents === catalog.plans[plan]?.cents,
      };
    }),
  );
}

export type SaveArgs = {
  version: string;
  plans: Record<PricedPlanKey, PricedPlan>;
  addCompanyCents: number;
  reason: string;
  existingPolicy: "grandfather" | "migrate";
  effectiveAt: string | null;
  createdBy: string | null;
};

/** Append a version and make it the active one. */
export async function savePricing(db: Db, args: SaveArgs): Promise<PricingCatalog> {
  const { data, error } = await db
    .from("pricing_sets")
    .insert({
      version: args.version,
      plans: args.plans,
      add_company_cents: args.addCompanyCents,
      reason: args.reason,
      existing_policy: args.existingPolicy,
      ...(args.effectiveAt ? { effective_at: args.effectiveAt } : {}),
      is_active: false,
      created_by: args.createdBy,
    } as never)
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't save the pricing version.");

  // One active row: stand the old one down before raising the new one, so the
  // partial unique index never sees two.
  const saved = pricingFromRow(data as unknown as PricingSetRow);
  const { error: offErr } = await db.from("pricing_sets").update({ is_active: false } as never).eq("is_active", true);
  if (offErr) throw new Error(offErr.message);
  const { error: onErr } = await db.from("pricing_sets").update({ is_active: true } as never).eq("id", saved.id as string);
  if (onErr) throw new Error(onErr.message);

  return { ...saved, isActive: true };
}

export async function getPricingSet(db: Db, id: string): Promise<PricingCatalog | null> {
  const { data } = await db.from("pricing_sets").select(COLS).eq("id", id).maybeSingle();
  return data ? pricingFromRow(data as unknown as PricingSetRow) : null;
}
