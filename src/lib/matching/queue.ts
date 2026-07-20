import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { logProfileView, countProfileViewers } from "@/lib/audit/log-profile-view";
import { PRE_INTRODUCTION_STATUSES, type MatchStatus } from "./transitions";

function fmtCheck(min: number | null, max: number | null): string | null {
  const f = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : `$${n}`);
  if (min != null && max != null) return `${f(min)} – ${f(max)}`;
  if (min != null) return `${f(min)}+`;
  if (max != null) return `Up to ${f(max)}`;
  return null;
}

function tokens(value: unknown): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value.map(String) : String(value).split(/[,;]/);
  return arr.map((s) => s.trim()).filter(Boolean).slice(0, 4);
}

export type FounderMatchItem = {
  matchId: string;
  status: MatchStatus;
  matchScore: number;
  investorType: string | null;
  sectors: string[];
  stages: string[];
  geographies: string[];
  checkSize: string | null;
};

/**
 * Founder-facing view of matches on their companies. Shows the investor's mandate
 * summary (type, sectors, stages, check size) at the interested/approved/introduced
 * stages — this is the "investor's profile summary" the founder acts on.
 */
export async function getFounderMatchQueue(
  founderUserId: string,
): Promise<{ items: FounderMatchItem[]; companyIds: string[] }> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;

  const { data: companies } = await admin.from("companies").select("id").eq("founder_id", founderUserId);
  const companyIds = ((companies ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (companyIds.length === 0) return { items: [], companyIds: [] };

  const { data: matches } = await admin
    .from("investor_founder_matches")
    .select("id, status, match_score, investor_profile_id")
    .in("company_id", companyIds)
    .in("status", ["investor_interested", "founder_approved", "introduced"])
    .order("match_score", { ascending: false })
    .limit(100);
  const rows = (matches ?? []) as Array<{ id: string; status: MatchStatus; match_score: number; investor_profile_id: string }>;
  if (rows.length === 0) return { items: [], companyIds };

  const investorIds = [...new Set(rows.map((r) => r.investor_profile_id))];
  const { data: investors } = await admin
    .from("investor_profiles")
    .select("id, investor_type, preferred_sectors, preferred_stages, preferred_geographies, check_size_min, check_size_max")
    .in("id", investorIds);
  const byId = new Map(
    (investors ?? []).map((i: {
      id: string; investor_type: string | null; preferred_sectors: unknown; preferred_stages: unknown;
      preferred_geographies: unknown; check_size_min: number | null; check_size_max: number | null;
    }) => [i.id, i]),
  );

  const items: FounderMatchItem[] = rows.map((r) => {
    const inv = byId.get(r.investor_profile_id);
    return {
      matchId: r.id,
      status: r.status,
      matchScore: Number(r.match_score ?? 0),
      investorType: inv?.investor_type ?? null,
      sectors: tokens(inv?.preferred_sectors),
      stages: tokens(inv?.preferred_stages),
      geographies: tokens(inv?.preferred_geographies),
      checkSize: fmtCheck(inv?.check_size_min ?? null, inv?.check_size_max ?? null),
    };
  });

  return { items, companyIds };
}

/** Total distinct viewers across all of a founder's companies. */
export async function countViewersForFounder(companyIds: string[]): Promise<number> {
  const counts = await Promise.all(companyIds.map((id) => countProfileViewers(id)));
  return counts.reduce((a, b) => a + b, 0);
}

/**
 * Log a match_card view for each of the investor's pre-introduction matches.
 * Reads company_id server-side only (never exposed to the client) and appends
 * audit rows so founders' "who viewed" count reflects investor attention.
 */
export async function logInvestorMatchCardViews(investorUserId: string): Promise<void> {
  const admin = createServiceRoleClient() as unknown as SupabaseClient;
  const { data: inv } = await admin.from("investor_profiles").select("id").eq("profile_id", investorUserId).maybeSingle();
  const investorProfileId = (inv as { id: string } | null)?.id;
  if (!investorProfileId) return;

  const { data: matches } = await admin
    .from("investor_founder_matches")
    .select("id, company_id")
    .eq("investor_profile_id", investorProfileId)
    .in("status", PRE_INTRODUCTION_STATUSES)
    .limit(100);

  for (const m of (matches ?? []) as Array<{ id: string; company_id: string }>) {
    await logProfileView({ viewerUserId: investorUserId, companyId: m.company_id, matchId: m.id, surface: "match_card" });
  }
}
