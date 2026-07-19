import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company } from "@/lib/supabase/types";
import { companyToMatchProfile, loadApprovedInvestorMatchProfiles } from "@/lib/matching/load-matching-data";
import { loadProspectInvestorMatchProfiles, isProspectInvestorId } from "@/lib/matching/prospect-investors";
import { matchInvestorToCompany } from "@/lib/matching/investor-company-matching";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadPartnerScoresBatch } from "@/lib/investor-rating/snapshot";
import { TIER_LABELS, type PartnerScore } from "@/lib/investor-rating/types";

export type OutreachStatus = "reached_out" | "queued" | "skipped" | "none";

export type InvestorMomentum = "active" | "warm" | "quiet";

export type FounderInvestorRow = {
  symbol: string;
  /** Investor display name (members from profiles, prospects from CRM). */
  name: string;
  label: string;
  matchScore: number;
  /** Per-factor fit for the profile popup (0 / 50 / 100). */
  fitSector: number;
  fitStage: number;
  fitCheck: number;
  fitGeo: number;
  /** Criteria shown in the profile popup. */
  stages: string[];
  geographies: string[];
  band: "high" | "mid" | "low";
  checkSize: string;
  sectors: string[];
  /** Real pledge activity by this investor across the platform. */
  pledgeCount: number;
  indicated: number;
  /** Relative time since this investor's last indication, e.g. "2h" / "5d". */
  lastActiveLabel: string | null;
  momentum: InvestorMomentum | null;
  /** Investor quality trend — null until investor-side snapshots exist. */
  trend: null;
  /** Where the admin-run introduction campaign stands with this investor. */
  outreach: OutreachStatus;
  /** Platform partner score (0–100), null when the investor is unrated ("New"). */
  investorScore: number | null;
  scoreTier: string | null;
  scoreRated: boolean;
};

export type FounderPrivateMarketSummary = {
  investorUniverse: number;
  totalContacts: number;
  reachedOut: number;
  pledgedTotal: number;
  strongCount: number;
  avgMatch: number | null;
  avgScore: number | null;
};

function matchBand(score: number): "high" | "mid" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}

function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function formatCheck(min: number | null, max: number | null): string {
  if (min != null && max != null) return `$${compact(min)}–$${compact(max)}`;
  if (min != null) return `$${compact(min)}+`;
  if (max != null) return `up to $${compact(max)}`;
  return "—";
}

function tokens(value: unknown): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value.map(String) : String(value).split(/[,;]/);
  return arr.map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

function relativeShort(ms: number): string {
  const minutes = ms / 60000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function momentumFor(ms: number): InvestorMomentum {
  if (ms < 24 * 60 * 60 * 1000) return "active";
  if (ms < 7 * 24 * 60 * 60 * 1000) return "warm";
  return "quiet";
}

type Activity = { count: number; sum: number; last: number };

/**
 * Rank approved platform investors by fit to the founder's company, enriched
 * with real pledge activity + momentum. Identities are anonymized. Trend is
 * intentionally null (no investor-side score history is collected yet).
 */
export async function loadFounderInvestorBoard(
  company: Company,
  limit = 50,
): Promise<{ rows: FounderInvestorRow[]; summary: FounderPrivateMarketSummary }> {
  // Full network: approved members + enriched prospects, ranked by fit. Identities
  // stay anonymized. Only members carry pledge / score / outreach enrichment.
  const [members, prospectData] = await Promise.all([
    loadApprovedInvestorMatchProfiles(),
    loadProspectInvestorMatchProfiles(),
  ]);
  const investors = [...members, ...prospectData.profiles];
  const memberCount = members.length;
  const profile = companyToMatchProfile(company);

  const scored = investors
    .map((investor) => ({ investor, match: matchInvestorToCompany(investor, profile) }))
    .sort((a, b) => b.match.matchScore - a.match.matchScore)
    .slice(0, limit);

  const admin = createServiceRoleClient();
  const rawAdmin = admin as unknown as SupabaseClient;

  // Enrichment applies to real member investors only (prospects have no
  // pledges, no partner score, and aren't outreach targets).
  const memberIds = scored
    .map((s) => s.investor.profile_id)
    .filter((id): id is string => Boolean(id) && !isProspectInvestorId(id));
  const ids = memberIds;
  const activity = new Map<string, Activity>();

  if (ids.length > 0) {
    const { data } = await admin
      .from("investor_interests")
      .select("investor_id, pledge_amount, pledge_amount_updated_at")
      .in("investor_id", ids)
      .not("pledge_amount", "is", null);

    for (const row of data ?? []) {
      const id = row.investor_id;
      if (!id) continue;
      const agg = activity.get(id) ?? { count: 0, sum: 0, last: 0 };
      agg.count += 1;
      agg.sum += row.pledge_amount != null ? Number(row.pledge_amount) : 0;
      const t = row.pledge_amount_updated_at ? new Date(row.pledge_amount_updated_at).getTime() : 0;
      if (t > agg.last) agg.last = t;
      activity.set(id, agg);
    }
  }

  // Platform partner ("investor") scores, batched.
  const scoreMap: Map<string, PartnerScore> =
    ids.length > 0 ? await loadPartnerScoresBatch(admin, ids) : new Map<string, PartnerScore>();

  // Display names: members from profiles, prospects from the CRM-sourced names map.
  const memberNameById = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: profs } = await admin.from("profiles").select("id, full_name, email").in("id", memberIds);
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      memberNameById.set(p.id, p.full_name || p.email || "Investor");
    }
  }
  const cleanName = (value: string) => value.replace(/ · prospect$/, "");

  // Outreach status per investor from this founder's own campaign (admin-run).
  const outreachByInvestor = new Map<string, string>();
  {
    const { data: campaign } = await rawAdmin
      .from("investor_outreach_campaigns")
      .select("id")
      .eq("company_id", company.id)
      .maybeSingle();
    const campaignId = (campaign as { id: string } | null)?.id ?? null;
    if (campaignId) {
      const { data: recips } = await rawAdmin
        .from("investor_outreach_recipients")
        .select("investor_ref, status")
        .eq("campaign_id", campaignId);
      for (const row of (recips ?? []) as Array<{ investor_ref: string; status: string }>) {
        outreachByInvestor.set(row.investor_ref, row.status);
      }
    }
  }

  // Total investor contacts in the network (investor CRM), for the reach stat.
  let totalContacts = investors.length;
  {
    const { count } = await rawAdmin
      .from("crm_contacts")
      .select("id", { count: "exact", head: true })
      .eq("module", "investor");
    if (typeof count === "number" && count > 0) totalContacts = count;
  }

  const now = Date.now();
  const rows: FounderInvestorRow[] = scored.map(({ investor, match }, index) => {
    const sectors = tokens(investor.preferred_sectors);
    const type = investor.investor_type ? String(investor.investor_type) : "Investor";
    const rawId = (investor.profile_id ?? "").replace(/^prospect:/, "");
    const code =
      rawId.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() ||
      String(index + 1).padStart(4, "0");
    const agg = investor.profile_id ? activity.get(investor.profile_id) : undefined;
    const lastMs = agg && agg.last ? now - agg.last : null;
    const rawOutreach = investor.profile_id ? outreachByInvestor.get(investor.profile_id) : undefined;
    const outreach: OutreachStatus =
      rawOutreach === "sent"
        ? "reached_out"
        : rawOutreach === "queued"
          ? "queued"
          : rawOutreach === "skipped"
            ? "skipped"
            : "none";
    const ps = investor.profile_id ? scoreMap.get(investor.profile_id) : undefined;
    const pid = investor.profile_id ?? "";
    const rawName = isProspectInvestorId(pid)
      ? cleanName(prospectData.names.get(pid) ?? "Network investor")
      : memberNameById.get(pid) ?? "Investor";
    const reasons = new Set(match.matchReasons);
    const fitCheck = reasons.has("Check size fit") ? 100 : reasons.has("Partial check size overlap") ? 50 : 0;
    return {
      symbol: `INV·${code}`,
      name: rawName,
      label: sectors.length ? `${type} · ${sectors.slice(0, 2).join(", ")} focus` : type,
      matchScore: match.matchScore,
      fitSector: reasons.has("Sector alignment") ? 100 : 0,
      fitStage: reasons.has("Stage alignment") ? 100 : 0,
      fitCheck,
      fitGeo: reasons.has("Geography alignment") ? 100 : 0,
      stages: tokens(investor.preferred_stages),
      geographies: tokens(investor.preferred_geographies),
      band: matchBand(match.matchScore),
      checkSize: formatCheck(investor.check_size_min ?? null, investor.check_size_max ?? null),
      sectors,
      pledgeCount: agg?.count ?? 0,
      indicated: agg?.sum ?? 0,
      lastActiveLabel: lastMs != null ? relativeShort(lastMs) : null,
      momentum: lastMs != null ? momentumFor(lastMs) : null,
      trend: null,
      outreach,
      investorScore: ps?.score ?? null,
      scoreTier: ps ? TIER_LABELS[ps.tier] : null,
      scoreRated: ps?.status === "rated",
    };
  });

  const shownScores = scored.map((s) => s.match.matchScore);
  const ratedScores = rows.map((r) => r.investorScore).filter((s): s is number => s != null);
  const summary: FounderPrivateMarketSummary = {
    investorUniverse: memberCount,
    totalContacts,
    reachedOut: rows.filter((r) => r.outreach === "reached_out").length,
    pledgedTotal: rows.reduce((total, r) => total + r.indicated, 0),
    strongCount: shownScores.filter((s) => s >= 75).length,
    avgMatch: shownScores.length
      ? Math.round((shownScores.reduce((a, b) => a + b, 0) / shownScores.length) * 10) / 10
      : null,
    avgScore: ratedScores.length
      ? Math.round(ratedScores.reduce((a, b) => a + b, 0) / ratedScores.length)
      : null,
  };

  return { rows, summary };
}
