import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company } from "@/lib/supabase/types";
import { loadInvestorContacts } from "@/lib/investors/load-investor-matches";
import { getInvestorMatchConfig } from "@/lib/settings/platform-settings";
import { resolveFounderOutreachConfig } from "@/lib/outreach/founder-overrides";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadPartnerScoresBatch } from "@/lib/investor-rating/snapshot";
import { TIER_LABELS, type PartnerScore } from "@/lib/investor-rating/types";

export type OutreachStatus = "clicked" | "opened" | "reached_out" | "queued" | "skipped" | "none";

export type InvestorMomentum = "active" | "warm" | "quiet";

export type FounderInvestorRow = {
  symbol: string;
  /** Investor display name (members from profiles, prospects from CRM). */
  name: string;
  /** Investor's firm / company from the CRM, when present. */
  company: string | null;
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
  /** When this investor was last contacted by the campaign (ISO), or null. */
  outreachActivityAt: string | null;
  /** For queued investors: the projected send date (ISO) from the weekly pass +
   *  cap ordering. Null for non-queued statuses. */
  scheduledSendAt: string | null;
  /** Queued but held: the campaign is paused (founder off-switch) or automation
   *  is paused (global / per-founder), so nothing sends until it resumes. */
  paused: boolean;
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
  // Rank investors by their LIVE structured profile (same engine as the admin
  // Investor-match page) scored against this company. Reads the editable CRM
  // "Investor Profile" fields (raw questionnaire + local overrides).
  const scoreAgainst = {
    fundingAmount: company.funding_amount ?? null,
    revenue: null,
    revenueStage: company.revenue_stage ?? null,
    useOfFunds: company.use_of_funds ?? null,
    industry: company.industry ?? null,
  };
  const matchConfig = await getInvestorMatchConfig();
  const scored = (await loadInvestorContacts({
    scoreAgainst,
    investorsOnly: true,
    requireIndustryMatch: matchConfig.requiredFields.industry,
    weights: matchConfig.weights,
    limit: 3000,
  })).slice(0, limit);

  const admin = createServiceRoleClient();
  const rawAdmin = admin as unknown as SupabaseClient;

  // Bridge CRM contacts to platform investor accounts by email so members keep
  // their pledge / partner-score / outreach enrichment. Contacts with no account
  // (prospects) simply stay unenriched.
  const emails = [...new Set(scored.map((s) => s.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e)))];
  const profileByEmail = new Map<string, string>();
  if (emails.length > 0) {
    const { data } = await rawAdmin.from("profiles").select("id, email").in("email", emails);
    for (const p of (data ?? []) as Array<{ id: string; email: string | null }>) {
      if (p.email) profileByEmail.set(p.email.trim().toLowerCase(), p.id);
    }
  }
  const pidOf = (email: string | null): string | null => (email ? profileByEmail.get(email.trim().toLowerCase()) ?? null : null);
  const memberIds = [...new Set(scored.map((s) => pidOf(s.email)).filter((id): id is string => Boolean(id)))];

  // Pledge activity (members only).
  const activity = new Map<string, Activity>();
  if (memberIds.length > 0) {
    const { data } = await admin
      .from("investor_interests")
      .select("investor_id, pledge_amount, pledge_amount_updated_at")
      .in("investor_id", memberIds)
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

  const scoreMap: Map<string, PartnerScore> =
    memberIds.length > 0 ? await loadPartnerScoresBatch(admin, memberIds) : new Map<string, PartnerScore>();

  // Outreach status per investor from this founder's own campaign (keyed by profile id).
  const outreachByInvestor = new Map<
    string,
    { status: string; sentAt: string | null; openedAt: string | null; clickedAt: string | null }
  >();
  let campaignLastRun: string | null = null;
  let campaignCap = 10;
  let campaignPaused = false;
  {
    const { data: campaign } = await rawAdmin
      .from("investor_outreach_campaigns")
      .select("id, last_run_at, weekly_cap, paused")
      .eq("company_id", company.id)
      .maybeSingle();
    const campMeta = campaign as { id: string; last_run_at: string | null; weekly_cap: number | null; paused: boolean | null } | null;
    const campaignId = campMeta?.id ?? null;
    campaignLastRun = campMeta?.last_run_at ?? null;
    campaignCap = campMeta?.weekly_cap ?? 10;
    campaignPaused = Boolean(campMeta?.paused);
    if (campaignId) {
      const { data: recips } = await rawAdmin
        .from("investor_outreach_recipients")
        .select("investor_ref, status, sent_at, opened_at, clicked_at")
        .eq("campaign_id", campaignId);
      for (const row of (recips ?? []) as Array<{
        investor_ref: string;
        status: string;
        sent_at: string | null;
        opened_at: string | null;
        clicked_at: string | null;
      }>) {
        outreachByInvestor.set(row.investor_ref, {
          status: row.status,
          sentAt: row.sent_at,
          openedAt: row.opened_at,
          clickedAt: row.clicked_at,
        });
      }
    }
  }

  // Total investor contacts in the network, for the reach stat.
  let totalContacts = scored.length;
  {
    const { count } = await rawAdmin
      .from("crm_contacts")
      .select("id", { count: "exact", head: true })
      .eq("module", "investor");
    if (typeof count === "number" && count > 0) totalContacts = count;
  }

  const now = Date.now();

  // Scheduled send date per queued investor: the weekly pass sends up to
  // `weekly_cap` (highest match first), so batch N goes out ~N weeks after the
  // next run. Next run = last run + ~6 days (the pass cadence), or now if unrun.
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const lastRunMs = campaignLastRun ? new Date(campaignLastRun).getTime() : null;
  const nextRunMs = lastRunMs ? Math.max(now, lastRunMs + 6 * 24 * 60 * 60 * 1000) : now;
  const cap = Math.max(1, campaignCap);
  const queuedRank = new Map<string, number>();
  let qi = 0;
  for (const s of scored) {
    if (outreachByInvestor.get(s.id)?.status === "queued") {
      queuedRank.set(s.id, qi);
      qi += 1;
    }
  }

  // Whether queued introductions are currently held: the founder's campaign is
  // paused, or automation is paused (global default or per-founder override).
  const eff = await resolveFounderOutreachConfig({ id: company.id, founder_id: company.founder_id });
  const todayIso = new Date().toISOString().slice(0, 10);
  const automationPaused = eff.pause.enabled && (!eff.pause.until || eff.pause.until >= todayIso);
  const boardPaused = campaignPaused || automationPaused;

  const rows: FounderInvestorRow[] = scored.map((s, index) => {
    const pid = pidOf(s.email);
    const reasons = new Set(s.match?.reasons ?? []);
    const matchScore = s.match?.score ?? 50;
    const sectors = s.sectors; // full list — shown as chips so nothing is cut off
    const type = s.investorType ?? "Investor";
    const code = String(s.id).replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || String(index + 1).padStart(4, "0");
    const agg = pid ? activity.get(pid) : undefined;
    const lastMs = agg && agg.last ? now - agg.last : null;
    // Outreach recipients are keyed by the CRM contact id (same id as s.id).
    const oe = outreachByInvestor.get(s.id);
    const outreach: OutreachStatus = oe?.clickedAt
      ? "clicked"
      : oe?.openedAt
        ? "opened"
        : oe?.status === "sent"
          ? "reached_out"
          : oe?.status === "queued"
            ? "queued"
            : oe?.status === "skipped"
              ? "skipped"
              : "none";
    const ps = pid ? scoreMap.get(pid) : undefined;
    return {
      symbol: `INV·${code}`,
      name: s.name,
      company: s.company ?? null,
      label: type,
      matchScore,
      fitSector: 0,
      fitStage: reasons.has("Use-of-funds / stage fit") ? 100 : 0,
      fitCheck: reasons.has("Check size fits the raise") ? 100 : 0,
      fitGeo: 0,
      stages: [],
      geographies: [],
      band: matchBand(matchScore),
      checkSize: s.preferences.investmentSize[0] ?? "—",
      sectors,
      pledgeCount: agg?.count ?? 0,
      indicated: agg?.sum ?? 0,
      lastActiveLabel: lastMs != null ? relativeShort(lastMs) : null,
      momentum: lastMs != null ? momentumFor(lastMs) : null,
      trend: null,
      outreach,
      outreachActivityAt: oe?.clickedAt ?? oe?.openedAt ?? oe?.sentAt ?? null,
      scheduledSendAt: oe?.status === "queued" && !boardPaused
        ? new Date(nextRunMs + Math.floor((queuedRank.get(s.id) ?? 0) / cap) * WEEK_MS).toISOString()
        : null,
      paused: outreach === "queued" ? boardPaused : false,
      investorScore: ps?.score ?? null,
      scoreTier: ps ? TIER_LABELS[ps.tier] : null,
      scoreRated: ps?.status === "rated",
    };
  });

  // Surface the most recently-contacted investors first; the rest keep their
  // match-ranked order below (stable sort).
  rows.sort((a, b) => {
    const at = a.outreachActivityAt ? Date.parse(a.outreachActivityAt) : -Infinity;
    const bt = b.outreachActivityAt ? Date.parse(b.outreachActivityAt) : -Infinity;
    return bt - at;
  });

  const shownScores = scored.map((s) => s.match?.score ?? 50);
  const ratedScores = rows.map((r) => r.investorScore).filter((s): s is number => s != null);
  const summary: FounderPrivateMarketSummary = {
    investorUniverse: totalContacts,
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
