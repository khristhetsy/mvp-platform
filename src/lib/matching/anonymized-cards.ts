import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { PRE_INTRODUCTION_STATUSES, type MatchStatus } from "./transitions";

/**
 * Investor-facing match card BEFORE an introduction. Deliberately excludes every
 * identifying field (company name, founder, logo, website). Served from a
 * controlled server function — never a direct row read of companies — so the RLS
 * on the base table stays airtight (spec §5.2).
 */
export type AnonymizedMatchCard = {
  matchId: string;
  status: MatchStatus;
  industry: string | null;
  stage: string | null;
  raiseBand: string | null;
  region: string | null;
  readinessBand: string;
  matchScore: number;
  scoreBreakdown: unknown;
};

function readinessBand(prescore: number): string {
  if (prescore >= 90) return "Exceptional (90+)";
  if (prescore >= 80) return "High (80–89)";
  if (prescore >= 70) return "Strong (70–79)";
  if (prescore >= 60) return "Moderate (60–69)";
  return "Developing (under 60)";
}

function raiseBand(amount: number | null): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  if (amount < 250_000) return "Under $250K";
  if (amount < 1_000_000) return "$250K – $1M";
  if (amount < 5_000_000) return "$1M – $5M";
  return "$5M+";
}

export async function getAnonymizedMatchCards(investorUserId: string): Promise<AnonymizedMatchCard[]> {
  const db = createServiceRoleClient() as unknown as SupabaseClient;

  const { data: inv } = await db
    .from("investor_profiles")
    .select("id")
    .eq("profile_id", investorUserId)
    .maybeSingle();
  const investorProfileId = (inv as { id: string } | null)?.id;
  if (!investorProfileId) return [];

  const { data: matches } = await db
    .from("investor_founder_matches")
    .select("id, company_id, status, match_score, prescore_at_match, score_breakdown")
    .eq("investor_profile_id", investorProfileId)
    .in("status", PRE_INTRODUCTION_STATUSES)
    .order("match_score", { ascending: false })
    .limit(100);

  const rows = (matches ?? []) as Array<{
    id: string;
    company_id: string;
    status: MatchStatus;
    match_score: number;
    prescore_at_match: number;
    score_breakdown: unknown;
  }>;
  if (rows.length === 0) return [];

  // Non-identifying company attributes only.
  const companyIds = [...new Set(rows.map((r) => r.company_id))];
  const { data: companies } = await db
    .from("companies")
    .select("id, industry, revenue_stage, funding_amount")
    .in("id", companyIds);
  const byId = new Map(
    (companies ?? []).map((c: { id: string; industry: string | null; revenue_stage: string | null; funding_amount: number | null }) => [c.id, c]),
  );

  return rows.map((r) => {
    const co = byId.get(r.company_id);
    return {
      matchId: r.id,
      status: r.status,
      industry: co?.industry ?? null,
      stage: co?.revenue_stage ?? null,
      raiseBand: raiseBand(co?.funding_amount ?? null),
      region: null, // coarse region not modeled on companies yet
      readinessBand: readinessBand(Number(r.prescore_at_match ?? 0)),
      matchScore: Number(r.match_score ?? 0),
      scoreBreakdown: r.score_breakdown ?? null,
    };
  });
}
