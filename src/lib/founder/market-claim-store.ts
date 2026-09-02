import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketClaimReport } from "@/lib/founder/market-claim";

// Persist / load the latest Market Claim Grader result for a company. Callers pass a
// service-role client after verifying the company belongs to the founder. Mirrors the
// pitch-deck analysis store.
function loose(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

export async function saveMarketClaimReport(
  admin: unknown,
  companyId: string,
  report: MarketClaimReport,
): Promise<string> {
  const updatedAt = new Date().toISOString();
  await loose(admin)
    .from("market_claim_reports")
    .upsert({ company_id: companyId, report, updated_at: updatedAt }, { onConflict: "company_id" });
  return updatedAt;
}

export async function getMarketClaimReport(
  admin: unknown,
  companyId: string,
): Promise<{ report: MarketClaimReport; updatedAt: string } | null> {
  const { data } = await loose(admin)
    .from("market_claim_reports")
    .select("report, updated_at")
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { report: MarketClaimReport; updated_at: string };
  return { report: row.report, updatedAt: row.updated_at };
}
