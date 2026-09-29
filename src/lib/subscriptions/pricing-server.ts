/**
 * Loading the pricing catalogue — server only.
 *
 * Cached per request so a page that prints a price in six places reads the row
 * once. Falls back to the code constants if the table isn't there yet, so a
 * deploy without the migration degrades quietly instead of showing $0.
 */
import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  CODE_DEFAULT_PRICING, pricingFromRow, type PricingCatalog, type PricingSetRow,
} from "@/lib/subscriptions/pricing-catalog";

const COLS = "id, version, plans, add_company_cents, reason, existing_policy, effective_at, is_active, created_by, created_at";

export const loadPricing = cache(async (): Promise<PricingCatalog> => {
  try {
    const { data } = await createServiceRoleClient()
      .from("pricing_sets")
      .select(COLS)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    return data ? pricingFromRow(data as unknown as PricingSetRow) : CODE_DEFAULT_PRICING;
  } catch {
    return CODE_DEFAULT_PRICING;
  }
});

export async function listPricingSets(): Promise<PricingCatalog[]> {
  try {
    const { data } = await createServiceRoleClient().from("pricing_sets").select(COLS).order("created_at", { ascending: false });
    return ((data ?? []) as unknown as PricingSetRow[]).map(pricingFromRow);
  } catch {
    return [CODE_DEFAULT_PRICING];
  }
}
