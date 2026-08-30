// Form D Desk — Investor Mode · shared pure logic for the Deno rollup Edge
// Function. Mirrors src/lib/formd/{normalize-firm,principal-identity,deal-event,
// score-profiles}.ts (kept in sync by hand — the Node copies carry the unit tests).
// deno-lint-ignore-file
import { createHmac } from "node:crypto";

// ── §5 Firm normalization ────────────────────────────────────────────────────
const ENTITY_SUFFIX = new Set(["lp", "llc", "ltd", "inc", "corp", "company", "co"]);
const FUND_ROLE = new Set(["fund", "partners", "management", "advisors", "holdings", "ventures"]);
const FUND_ROLE_PHRASES = ["capital partners"];
const VEHICLE_WORDS = new Set(["annex", "overage", "parallel", "feeder", "master", "offshore", "onshore", "qp", "ai", "co-invest", "spv", "international", "domestic", "intermediate", "aggregator", "blocker", "trust", "series", "class"]);
const ROMAN = new Set(["i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx"]);
const ORDINALS = new Set(["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","first","second","third","fourth","fifth","sixth","seventh","eighth","ninth","tenth"]);

function dedot(name: string): string {
  return name.replace(/\b([A-Za-z])\.(?=[A-Za-z]\.)/g, "$1").replace(/\b([A-Za-z])\.(?=\s|$)/g, "$1");
}
function cleanStem(s: string): string {
  return s.replace(/\b\d{4}\b/g, " ").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
export function normalizeFirm(entityName: string): { firmStem: string; needsReview: boolean } {
  const raw = (entityName ?? "").trim();
  if (!raw) return { firmStem: "", needsReview: true };
  const series = raw.match(/\ba series of\s+(.+)$/i);
  const source = series ? series[1] : raw;
  let work = dedot(source).toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const phrase of FUND_ROLE_PHRASES) {
      if (work.endsWith(" " + phrase) || work === phrase) { work = work.slice(0, work.length - phrase.length).trim(); changed = true; }
    }
    const tokens = work.split(" ");
    const last = tokens[tokens.length - 1];
    const isCode = /^\d{4}$/.test(last ?? "") || /^[a-z]{0,3}-?\d[\d-]*$/.test(last ?? "");
    if (last && (last === "-" || ENTITY_SUFFIX.has(last) || FUND_ROLE.has(last) || VEHICLE_WORDS.has(last) || ROMAN.has(last) || ORDINALS.has(last) || isCode)) {
      tokens.pop(); work = tokens.join(" ").trim(); changed = true;
    }
  }
  const stem = cleanStem(work);
  if (stem.replace(/[\s-]/g, "").length < 3) return { firmStem: cleanStem(raw), needsReview: true };
  return { firmStem: stem, needsReview: false };
}

// ── §6 Principal identity ────────────────────────────────────────────────────
const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
// Persisted related-persons carry no street/postal (never stored), so the rollup
// uses the firm-scoped fallback: name|firm_id. Street-based hashing (the 0.75 deal
// tier) requires computing at ingest time with the address in memory — a follow-up.
export function principalIdentityHash(input: { firstName: string; lastName: string; firmId: string }, key: string): string {
  const base = `${lc(input.firstName)}|${lc(input.lastName)}|${input.firmId}`;
  return createHmac("sha256", key).update(base).digest("hex");
}

// ── §7 Deal-event confidence ─────────────────────────────────────────────────
export const DEAL_DISPLAY_THRESHOLD = 0.75;
export function dealEventConfidence(s: { namedInRecipients: boolean; identityHashMatch: boolean; nameMatch: boolean; isDirector: boolean; issuerPostDatesFundFirstFiling: boolean }): number {
  if (s.namedInRecipients) return 0.95;
  if (s.identityHashMatch && s.isDirector && s.issuerPostDatesFundFirstFiling) return 0.75;
  if (s.nameMatch && s.isDirector) return 0.55;
  return 0;
}

// ── §8.2 Activity band ───────────────────────────────────────────────────────
export function activityBand(investments24mo: number): "observed" | "single" | "registry" {
  if (investments24mo >= 2) return "observed";
  if (investments24mo === 1) return "single";
  return "registry";
}

/** Median of a numeric list (§8.4 — median, not mean; one outlier distorts n=3). */
export function median(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2);
}

// ── §8.1 Rating (one engine, two profiles) — mirrors src/lib/formd/score-profiles.ts.
// Recency INVERTS between profiles (issuer: older-better = stalled raise; investor:
// newer-better = actively deploying). Registry firms never get a number (§8.2).
export type RecencyDirection = "older-better" | "newer-better";
export type ScoreProfile = {
  recencyWeight: number; recencyDirection: RecencyDirection; volumeWeight: number;
  fitWeight: number; typeWeight: number; positionWeight: number; reachWeight: number;
};
export const SCORE_PROFILES: Record<"issuer" | "investor", ScoreProfile> = {
  issuer: { recencyWeight: 0.25, recencyDirection: "older-better", volumeWeight: 0.25, fitWeight: 0.15, typeWeight: 0.15, positionWeight: 0.1, reachWeight: 0.1 },
  investor: { recencyWeight: 0.25, recencyDirection: "newer-better", volumeWeight: 0.2, fitWeight: 0.2, typeWeight: 0.15, positionWeight: 0.1, reachWeight: 0.1 },
};

export function recencySignal(days: number, direction: RecencyDirection, horizonDays = 730): number {
  const clamped = Math.max(0, Math.min(days, horizonDays));
  const fresh = 1 - clamped / horizonDays;
  return direction === "newer-better" ? fresh : 1 - fresh;
}

export type ScoreSignals = { recencyDays: number; volume: number; fit: number; type: number; position: number; reach: number };

/** Weighted 0..100 score for a profile; caller pre-normalizes signals to 0..1. */
export function scoreWithProfile(signals: ScoreSignals, profile: ScoreProfile): number {
  const recency = recencySignal(signals.recencyDays, profile.recencyDirection);
  const raw =
    recency * profile.recencyWeight +
    signals.volume * profile.volumeWeight +
    signals.fit * profile.fitWeight +
    signals.type * profile.typeWeight +
    signals.position * profile.positionWeight +
    signals.reach * profile.reachWeight;
  return Math.round(raw * 100);
}

/** Registry band never shows a rank (§8.2) — 75% of the register scored on type +
 *  geography alone can't order a queue. */
export function bandShowsRank(band: "observed" | "single" | "registry"): boolean {
  return band !== "registry";
}
