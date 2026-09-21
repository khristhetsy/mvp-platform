import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database } from "@/lib/supabase/types";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import { buildProfileCompletion } from "@/lib/data/founder-readiness";

/**
 * Investable Score — a rules-based readiness signal (0–100). Composite of the
 * diligence/readiness score, profile completeness, and the onboarding/document
 * gates. This is the single source of truth for the number shown on the founder
 * journey (Qualify), the Deploy workflow, and the investor-facing one-pager, so
 * they never disagree.
 *
 * It is NOT a rating of the securities or investment advice.
 */
export function computeInvestableScore(input: {
  readinessScore: number;
  profilePercent: number;
  onboardingComplete: boolean;
  requiredDocsUploaded: boolean;
}): number {
  return Math.round(
    Math.min(
      100,
      0.6 * input.readinessScore +
        0.3 * input.profilePercent +
        (input.onboardingComplete ? 5 : 0) +
        (input.requiredDocsUploaded ? 5 : 0),
    ),
  );
}

/**
 * Company-scoped Investable Score, resolved from the founder who owns the
 * company. Self-contained so both authenticated (founder) and public
 * (investor one-pager) surfaces produce an identical number. Returns null if
 * the founder/company can't be resolved.
 */
export async function loadInvestableScore(
  supabase: SupabaseClient<Database>,
  founderId: string,
): Promise<number | null> {
  if (!founderId) return null;

  const [state, companyRes] = await Promise.all([
    evaluateFounderJourney(supabase, founderId),
    supabase
      .from("companies")
      .select(
        "company_name, industry, business_description, funding_amount, use_of_funds, revenue_stage, team_summary",
      )
      .eq("founder_id", founderId)
      .maybeSingle(),
  ]);

  const company = (companyRes.data ?? null) as Company | null;
  const profilePercent = buildProfileCompletion(company).percent;

  return computeInvestableScore({
    readinessScore: state.conditions.readinessScore ?? 0,
    profilePercent,
    onboardingComplete: state.conditions.onboardingComplete,
    requiredDocsUploaded: state.conditions.requiredDocsUploaded,
  });
}
