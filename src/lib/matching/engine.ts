import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { matchInvestorToCompany, type InvestorMatchProfile } from "@/lib/matching/investor-company-matching";
import { loadAdminCompanyMatchProfiles } from "@/lib/matching/load-matching-data";
import { notifyInvestorsOfNewMatches } from "@/lib/matching/notify";

// Founder eligibility is keyed on readiness (from diligence_reports, via
// loadAdminCompanyMatchProfiles) — NOT the prospect-only `lead_prescore` field.
// prescore_at_match snapshots that readiness score.
const DEFAULT_READINESS_THRESHOLD = 60;
const DEFAULT_MATCH_THRESHOLD = 60;

export type MatchingPassResult = {
  companiesEligible: number;
  investorsConsidered: number;
  suggestedWritten: number;
};

/**
 * Generate `suggested` matches for eligible founders × approved investors.
 * Idempotent: existing pairs (any status) are never overwritten. Runs via
 * service role from the cron.
 */
export async function runMatchingPass(opts?: {
  readinessThreshold?: number;
  matchThreshold?: number;
}): Promise<MatchingPassResult> {
  const readinessThreshold = opts?.readinessThreshold ?? DEFAULT_READINESS_THRESHOLD;
  const matchThreshold = opts?.matchThreshold ?? DEFAULT_MATCH_THRESHOLD;
  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  const companies = await loadAdminCompanyMatchProfiles();
  const eligible = companies.filter(
    (c) => typeof c.readinessScore === "number" && (c.readinessScore ?? 0) >= readinessThreshold,
  );
  if (eligible.length === 0) {
    return { companiesEligible: 0, investorsConsidered: 0, suggestedWritten: 0 };
  }

  const { data: investorRows } = await admin
    .from("investor_profiles")
    .select(
      "id, profile_id, investor_type, check_size_min, check_size_max, preferred_sectors, preferred_geographies, preferred_stages, approval_status",
    )
    .eq("approval_status", "approved");
  const investors = (investorRows ?? []) as Array<InvestorMatchProfile & { id: string }>;
  if (investors.length === 0) {
    return { companiesEligible: eligible.length, investorsConsidered: 0, suggestedWritten: 0 };
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const company of eligible) {
    for (const investor of investors) {
      const result = matchInvestorToCompany(investor, company);
      if (result.matchScore < matchThreshold) continue;
      rows.push({
        company_id: company.id,
        investor_profile_id: investor.id,
        status: "suggested",
        match_score: result.matchScore,
        prescore_at_match: company.readinessScore ?? 0,
        fit_score_at_match: result.matchScore, // engine blends fit; snapshot proxy
        score_breakdown: { reasons: result.matchReasons, missing: result.missingFitReasons },
      });
    }
  }
  if (rows.length === 0) {
    return { companiesEligible: eligible.length, investorsConsidered: investors.length, suggestedWritten: 0 };
  }

  // Ignore existing pairs so we never overwrite a live consent flow.
  const { data: inserted, error } = await admin
    .from("investor_founder_matches")
    .upsert(rows, { onConflict: "company_id,investor_profile_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`Matching upsert failed: ${error.message}`);

  return {
    companiesEligible: eligible.length,
    investorsConsidered: investors.length,
    suggestedWritten: (inserted ?? []).length,
  };
}

/**
 * Promote freshly-suggested matches to `investor_notified` so they surface as
 * anonymized cards. suggested → investor_notified is a valid system transition;
 * the guarded bulk update only ever moves rows out of `suggested`.
 * (Email/in-app delivery is layered by the notification job — separate ticket.)
 */
export async function promoteSuggestedMatches(): Promise<{ promoted: number }> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { data, error } = await admin
    .from("investor_founder_matches")
    .update({ status: "investor_notified" })
    .eq("status", "suggested")
    .select("id, investor_profile_id");
  if (error) throw new Error(`Promotion failed: ${error.message}`);

  const promoted = (data ?? []) as Array<{ id: string; investor_profile_id: string }>;
  await notifyInvestorsOfNewMatches(promoted);
  return { promoted: promoted.length };
}
