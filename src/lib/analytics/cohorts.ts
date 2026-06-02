import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { TrendSeries, TrendWindowDays } from "@/lib/analytics/types";
import { buildDailyCountSeries } from "@/lib/analytics/trends";

function sinceIso(windowDays: TrendWindowDays): string {
  return new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Phase 1 cohorts are intentionally lightweight: counts by day in a window.
 * We avoid retention/prediction until a warehouse exists.
 */
export async function loadBasicCohorts(
  supabase: SupabaseClient<Database>,
  windowDays: TrendWindowDays,
): Promise<{ companiesCreated: TrendSeries; investorsCreated: TrendSeries }> {
  const since = sinceIso(windowDays);
  const [companies, investors] = await Promise.all([
    supabase.from("companies").select("created_at").gte("created_at", since).limit(5000),
    supabase.from("profiles").select("created_at").ilike("role", "investor").gte("created_at", since).limit(5000),
  ]);

  return {
    companiesCreated: buildDailyCountSeries({
      key: "companies_created",
      label: "Companies created",
      windowDays,
      timestamps: (companies.data ?? []).map((r) => r.created_at as string),
    }),
    investorsCreated: buildDailyCountSeries({
      key: "investors_created",
      label: "Investors created",
      windowDays,
      timestamps: (investors.data ?? []).map((r) => r.created_at as string),
    }),
  };
}

