/**
 * Pure builders for the Private Market weekly emails. Input is the score
 * history of non sample companies (one event per reading); output is the
 * numbers the founder and investor emails show. No database access here.
 */
import { bandKeyForScore, type ReadinessBandKey } from "@/lib/marketplace/readiness-board";
import type { ScoreEvent } from "@/lib/marketplace/market-board";

const DAY = 86_400_000;

export const BAND_LABEL: Record<ReadinessBandKey, string> = { strong: "Strong", moderate: "Moderate", building: "Building" };

const byTime = (events: ReadonlyArray<ScoreEvent>) =>
  events.filter((e) => Number.isFinite(Date.parse(e.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

/** Latest numeric score per company at or before asOfMs. */
export function latestScores(events: ReadonlyArray<ScoreEvent>, asOfMs: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of byTime(events)) {
    if (Date.parse(e.at) > asOfMs) break;
    if (typeof e.score === "number" && Number.isFinite(e.score)) out.set(e.companyId, e.score);
    else out.delete(e.companyId);
  }
  return out;
}

export type RatingMove = { companyId: string; from: number | null; to: number; change: number };

/**
 * Companies whose rating changed in the trailing window. `from` is the rating a
 * window ago (null when the first reading came inside the window).
 */
export function ratingMoves(events: ReadonlyArray<ScoreEvent>, nowMs: number, windowDays = 7): RatingMove[] {
  const now = latestScores(events, nowMs);
  const then = latestScores(events, nowMs - windowDays * DAY);
  const out: RatingMove[] = [];
  for (const [companyId, to] of now) {
    const from = then.get(companyId) ?? null;
    if (from === to) continue;
    out.push({ companyId, from, to, change: from === null ? to : to - from });
  }
  return out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || b.to - a.to);
}

export type FounderRating = {
  score: number;
  band: ReadinessBandKey;
  /** Change over the last window; null when there was no reading a window ago. */
  weekChange: number | null;
  weekAgo: number | null;
  firstScore: number | null;
  firstAt: string | null;
  sinceFirst: number | null;
  rank: number;
  of: number;
};

/** One company's rating story for the founder email; null when the company has no score. */
export function founderRating(events: ReadonlyArray<ScoreEvent>, companyId: string, nowMs: number, windowDays = 7): FounderRating | null {
  const now = latestScores(events, nowMs);
  const score = now.get(companyId);
  if (score === undefined) return null;
  const weekAgo = latestScores(events, nowMs - windowDays * DAY).get(companyId) ?? null;
  const own = byTime(events).filter((e) => e.companyId === companyId && typeof e.score === "number" && Date.parse(e.at) <= nowMs);
  const first = own[0];
  const rank = 1 + [...now.values()].filter((s) => s > score).length;
  return {
    score,
    band: bandKeyForScore(score),
    weekChange: weekAgo === null ? null : score - weekAgo,
    weekAgo,
    firstScore: first ? (first.score as number) : null,
    firstAt: first?.at ?? null,
    sinceFirst: first && own.length > 1 ? score - (first.score as number) : null,
    rank,
    of: now.size,
  };
}

/** "9th", "22nd", "11th". */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** A market tile. change is the raw 7 day change (null when there was no reading a week ago). */
export type DigestTile = { label: string; value: string; change: number | null; delta: string | null };

export type GainerRow = { symbol: string; crr: number; change: number; pct: number | null };
export type SectorLine = { sector: string; avg: number; scored: number };
export type MoveLine = { symbol: string; from: number | null; to: number };

/** Everything in the email that is the same for every recipient. */
export type DigestMarket = {
  /** "30 Oct to 6 Nov 2026" */
  range: string;
  asOfLabel: string;
  tiles: DigestTile[];
  avgCrr: number | null;
  gainers: GainerRow[];
  sectors: SectorLine[];
  approvedTotal: number;
  newlyApproved: { count: number; scored: number };
  moves: MoveLine[];
};

export type DigestMatch = { symbol: string; name: string; match: number; crr: number | null; sector: string | null };

export type DigestViewer =
  | { kind: "founder"; rating: FounderRating | null; marketOnly?: false }
  | { kind: "founder"; rating?: null; marketOnly: true }
  | { kind: "investor"; matches: DigestMatch[]; hasProfile: boolean; marketOnly?: false }
  | { kind: "investor"; matches?: []; hasProfile?: false; marketOnly: true };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const d = (ms: number) => new Date(ms);

/** "30 Oct to 6 Nov 2026" for the 7 days ending at nowMs (UTC dates). */
export function rangeLabel(nowMs: number, windowDays = 7): string {
  const a = d(nowMs - windowDays * DAY);
  const b = d(nowMs);
  const left = `${a.getUTCDate()} ${MON[a.getUTCMonth()]}`;
  return `${left} to ${b.getUTCDate()} ${MON[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

export function dateLabel(ms: number): string {
  const x = d(ms);
  return `${x.getUTCDate()} ${MON[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}

/** True when no tracked number moved: used by "skip a week when nothing changed". */
export function nothingChanged(m: DigestMarket): boolean {
  return m.moves.length === 0 && m.newlyApproved.count === 0 && m.tiles.every((t) => !t.change);
}
