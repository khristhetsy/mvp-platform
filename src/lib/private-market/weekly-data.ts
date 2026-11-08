/**
 * Server side data for the Private Market weekly emails: the market numbers
 * every recipient sees, and each recipient's own rating (founders) or matches
 * (investors). Real data only. Returns null when the market numbers cannot be
 * read, so nothing is ever sent with a made up figure.
 */
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getMarketBoard } from "@/lib/data/market-board";
import { listApprovedCompanies } from "@/lib/listing/private-market";
import { ARROW, directionOf, signed, signedPct, type ScoreEvent } from "@/lib/marketplace/market-board";
import { matchScoresForInvestor } from "@/lib/matching/private-market-match";
import { toSymbol } from "@/lib/investor/private-market";
import {
  dateLabel, founderRating, hasIntroActivity, latestScores, rangeLabel, ratingMoves,
  type DigestMarket, type DigestMatch, type DigestTile, type DigestViewer, type IntroActivity, type MonthlyDigest, type NewCompanyLine,
} from "./weekly-digest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const PAGE = 1000;
const DAY = 86_400_000;

export type WeeklyContext = {
  nowMs: number;
  market: DigestMarket;
  events: ScoreEvent[];
  companies: Array<{ id: string; name: string; symbol: string; industry: string | null; crr: number | null }>;
  /** Approved company per founder profile (first one when a founder has several). */
  companyByFounder: Map<string, string>;
};

async function loadEvents(db: any): Promise<ScoreEvent[]> {
  const out: ScoreEvent[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("company_readiness_scores")
      .select("company_id, created_at, total_score, effective_score, companies!inner(is_sample)")
      .eq("companies.is_sample", false)
      .order("created_at", { ascending: true })
      .order("company_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as any[]) out.push({ companyId: r.company_id, at: r.created_at, score: r.effective_score ?? r.total_score });
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function loadWeeklyContext(now: Date = new Date()): Promise<WeeklyContext | null> {
  try {
    const db: any = createServiceRoleClient();
    const nowMs = now.getTime();
    const approved = await listApprovedCompanies({}, db);
    const ids = approved.map((c) => c.id);
    const iso = (days: number) => new Date(nowMs - days * DAY).toISOString();
    const approvedCount = (from: string, to: string) =>
      db.from("companies").select("id", { count: "exact", head: true }).eq("review_status", "approved").or("is_sample.is.null,is_sample.eq.false").gte("approved_at", from).lt("approved_at", to);
    const introCount = (from: string, to: string) => db.from("intro_requests").select("id", { count: "exact", head: true }).gte("created_at", from).lt("created_at", to);
    const [board, events, newly, owners, added30, added60, intros30, intros60] = await Promise.all([
      getMarketBoard(ids, db),
      loadEvents(db),
      db.from("companies").select("id, company_name, industry").eq("review_status", "approved").or("is_sample.is.null,is_sample.eq.false").gte("approved_at", iso(7)).order("approved_at", { ascending: false }),
      db.from("companies").select("id, founder_id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      approvedCount(iso(30), iso(-1)),
      approvedCount(iso(60), iso(30)),
      introCount(iso(30), iso(-1)),
      introCount(iso(60), iso(30)),
    ]);
    if (!board) return null;
    if (newly.error) throw new Error(newly.error.message);

    const companies = approved.map((c) => ({ id: c.id, name: c.name, symbol: toSymbol(c.name), industry: c.industry, crr: c.crr }));
    const symbol = new Map(companies.map((c) => [c.id, c.symbol]));
    const scoredNow = new Set(events.filter((e) => typeof e.score === "number").map((e) => e.companyId));
    const newlyRows = (newly.data ?? []) as Array<{ id: string; company_name: string | null; industry: string | null }>;
    const newlyIds = newlyRows.map((r) => r.id);

    const t = board.tiles;
    const tile = (label: string, value: string, change: number | null, pct: number | null, digits = 0): DigestTile => ({
      label, value, change,
      delta: change === null ? null : `${ARROW[directionOf(change)]} ${signed(change, digits)} · ${signedPct(pct)}`,
    });
    const tiles: DigestTile[] = [
      t.avgCrr ? tile("AVG CRR", t.avgCrr.value.toFixed(1), t.avgCrr.change, t.avgCrr.pct, 2) : { label: "AVG CRR", value: "n/a", change: null, delta: null },
      tile("FOUNDERS SCORED", String(t.founders.value), t.founders.change, t.founders.pct),
      tile("STRONG BAND", String(t.strong.value), t.strong.change, t.strong.pct),
      tile("OUTREACH", board.outreach.total.toLocaleString("en-US"), board.outreach.change, board.outreach.total - board.outreach.change > 0 ? (board.outreach.change / (board.outreach.total - board.outreach.change)) * 100 : null),
    ];

    const gainers = Object.entries(board.byCompany)
      .filter(([, v]) => v.crr && v.crr.change > 0)
      .sort((a, b) => (b[1].crr!.change - a[1].crr!.change))
      .slice(0, 5)
      .map(([id, v]) => ({ symbol: symbol.get(id) ?? "", crr: v.crr!.latest, change: v.crr!.change, pct: v.crr!.pct }));

    const nowScores = latestScores(events, nowMs);
    const thirtyAgo = latestScores(events, nowMs - 30 * DAY);
    const avgOf = (m: Map<string, number>) => (m.size ? [...m.values()].reduce((a, b) => a + b, 0) / m.size : null);
    const industryOf = new Map(companies.map((c) => [c.id, c.industry]));
    const newCompanies: NewCompanyLine[] = newlyRows.map((r) => {
      const crr = nowScores.get(r.id) ?? null;
      const sameSector = r.industry ? [...nowScores.entries()].filter(([id]) => industryOf.get(id) === r.industry).map(([, v]) => v) : [];
      return {
        symbol: toSymbol(r.company_name ?? "Company"), name: r.company_name?.trim() || "Company", sector: r.industry, crr,
        rank: crr === null ? null : 1 + [...nowScores.values()].filter((v) => v > crr).length,
        of: nowScores.size,
        sectorAvg: sameSector.length ? sameSector.reduce((a, b) => a + b, 0) / sameSector.length : null,
      };
    });
    const monthGainers = ratingMoves(events, nowMs, 30)
      .filter((m) => m.change > 0 && m.from !== null && symbol.has(m.companyId))
      .slice(0, 5)
      .map((m) => ({ symbol: symbol.get(m.companyId) as string, crr: m.to, change: m.change, pct: (m.from as number) > 0 ? (m.change / (m.from as number)) * 100 : null }));
    const monthly: MonthlyDigest = {
      range: rangeLabel(nowMs, 30),
      approved: { total: approved.length, added: added30.count ?? 0, addedBefore: added60.count ?? 0 },
      avgCrr: { now: avgOf(nowScores), before: avgOf(thirtyAgo) },
      scored: { now: nowScores.size, before: thirtyAgo.size },
      intros: { now: intros30.count ?? 0, before: intros60.count ?? 0 },
      gainers: monthGainers,
    };

    const market: DigestMarket = {
      newCompanies,
      monthly,
      range: rangeLabel(nowMs),
      asOfLabel: dateLabel(nowMs),
      tiles,
      avgCrr: t.avgCrr?.value ?? null,
      gainers,
      sectors: board.sectors.filter((s) => s.avg !== null).slice(0, 5).map((s) => ({ sector: s.sector, avg: s.avg as number, scored: s.scored })),
      approvedTotal: approved.length,
      newlyApproved: { count: newlyIds.length, scored: newlyIds.filter((id) => scoredNow.has(id)).length },
      moves: ratingMoves(events, nowMs).filter((m) => symbol.has(m.companyId)).slice(0, 5).map((m) => ({ symbol: symbol.get(m.companyId) as string, from: m.from, to: m.to })),
    };

    const companyByFounder = new Map<string, string>();
    for (const r of (owners.data ?? []) as Array<{ id: string; founder_id: string | null }>) {
      if (r.founder_id && !companyByFounder.has(r.founder_id)) companyByFounder.set(r.founder_id, r.id);
    }
    return { nowMs, market, events, companies, companyByFounder };
  } catch (err) {
    console.error("[private-market-weekly] context failed", err);
    return null;
  }
}

/** A founder's own rating. A founder whose company is not approved yet still sees their rating when they have one. */
export async function founderViewer(ctx: WeeklyContext, profileId: string): Promise<DigestViewer> {
  let companyId = ctx.companyByFounder.get(profileId) ?? null;
  if (!companyId) {
    const { data } = await (createServiceRoleClient() as any).from("companies").select("id").eq("founder_id", profileId).or("is_sample.is.null,is_sample.eq.false").limit(1);
    companyId = (data?.[0]?.id as string | undefined) ?? null;
  }
  return { kind: "founder", rating: companyId ? founderRating(ctx.events, companyId, ctx.nowMs) : null };
}

export async function investorViewer(ctx: WeeklyContext, profileId: string): Promise<DigestViewer> {
  const scores = await matchScoresForInvestor(profileId, ctx.companies.map((c) => c.id));
  const matches: DigestMatch[] = ctx.companies
    .filter((c) => scores.has(c.id))
    .map((c) => ({ symbol: c.symbol, name: c.name, match: scores.get(c.id) as number, crr: c.crr, sector: c.industry }))
    .sort((a, b) => b.match - a.match)
    .slice(0, 3);
  return { kind: "investor", matches, hasProfile: scores.size > 0 };
}

/** One investor's introduction requests over the last 7 days, from their own rows only. */
export async function introActivity(ctx: WeeklyContext, profileId: string): Promise<IntroActivity> {
  const db: any = createServiceRoleClient();
  const since = new Date(ctx.nowMs - 7 * DAY).toISOString();
  const [recent, reviewing] = await Promise.all([
    db.from("intro_requests").select("status, created_at, updated_at, companies(company_name)").eq("investor_id", profileId).gte("updated_at", since).order("updated_at", { ascending: false }).limit(200),
    db.from("intro_requests").select("id", { count: "exact", head: true }).eq("investor_id", profileId).eq("status", "reviewing"),
  ]);
  const rows = (recent.data ?? []) as Array<{ status: string; created_at: string; updated_at: string; companies: { company_name: string | null } | { company_name: string | null }[] | null }>;
  const nameOf = (r: (typeof rows)[number]) => (Array.isArray(r.companies) ? r.companies[0]?.company_name : r.companies?.company_name) ?? "";
  return {
    requested: rows.filter((r) => r.created_at >= since).length,
    facilitated: rows.filter((r) => r.status === "facilitated").length,
    declined: rows.filter((r) => r.status === "declined").length,
    reviewing: reviewing.count ?? 0,
    latest: rows.filter((r) => nameOf(r)).slice(0, 5).map((r) => ({ symbol: toSymbol(nameOf(r)), status: r.status })),
  };
}

export const marketOnlyViewer = (audience: "founder" | "investor"): DigestViewer =>
  audience === "founder" ? { kind: "founder", marketOnly: true } : { kind: "investor", marketOnly: true };

export type PreviewExample = { key: string; label: string; viewer: DigestViewer };
export type PreviewSet = { founder: PreviewExample[]; investor: PreviewExample[]; intros: PreviewExample[] };

/** Real people for the admin preview: a scored founder, an unscored founder, an investor with matches. */
export async function previewExamples(ctx: WeeklyContext): Promise<PreviewSet> {
  const db: any = createServiceRoleClient();
  const founder: PreviewExample[] = [];
  const scoredIds = new Set(ctx.events.filter((e) => typeof e.score === "number").map((e) => e.companyId));
  let scored: { id: string; name: string; founder: string } | null = null;
  for (const c of ctx.companies) {
    const owner = [...ctx.companyByFounder.entries()].find(([, cid]) => cid === c.id)?.[0];
    if (!owner) continue;
    if (scoredIds.has(c.id) && !scored) { scored = { id: c.id, name: c.name, founder: owner }; break; }
  }
  if (scored) founder.push({ key: "scored", label: `Scored founder (${scored.name})`, viewer: await founderViewer(ctx, scored.founder) });
  founder.push({ key: "none", label: "Founder not scored yet", viewer: { kind: "founder", rating: null } });
  const investor: PreviewExample[] = [];
  const { data } = await db.from("investor_profiles").select("profile_id").eq("approval_status", "approved").limit(5);
  for (const r of (data ?? []) as Array<{ profile_id: string }>) {
    const v = await investorViewer(ctx, r.profile_id);
    if (v.kind === "investor" && v.matches && v.matches.length > 0) { investor.push({ key: "matches", label: "Investor with matches", viewer: v }); break; }
  }
  if (investor.length === 0) investor.push({ key: "none", label: "Investor with no matches yet", viewer: { kind: "investor", matches: [], hasProfile: false } });
  const intros: PreviewExample[] = [];
  for (const r of (data ?? []) as Array<{ profile_id: string }>) {
    const v = await investorViewer(ctx, r.profile_id);
    const activity = await introActivity(ctx, r.profile_id);
    if (v.kind === "investor" && !v.marketOnly && hasIntroActivity(activity)) { intros.push({ key: "activity", label: "Investor with introduction activity", viewer: { kind: "investor", matches: v.matches, hasProfile: v.hasProfile, intros: activity } }); break; }
  }
  intros.push({ key: "none", label: "Investor with no activity", viewer: { kind: "investor", matches: [], hasProfile: false, intros: { requested: 0, facilitated: 0, declined: 0, reviewing: 0, latest: [] } } });
  return { founder, investor, intros };
}

/** The preview group a version uses. */
export const exampleGroup = (v: "founder" | "investor" | "listed" | "intros" | "monthly"): keyof PreviewSet => (v === "founder" ? "founder" : v === "intros" ? "intros" : "investor");
