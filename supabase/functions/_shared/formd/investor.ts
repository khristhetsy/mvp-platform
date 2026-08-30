// Form D Desk — Investor Mode · shared pure logic for the Deno rollup Edge
// Function. Mirrors src/lib/formd/{normalize-firm,principal-identity,deal-event,
// score-profiles}.ts (kept in sync by hand — the Node copies carry the unit tests).
// deno-lint-ignore-file
import { createHmac } from "node:crypto";

// ── §5 Firm normalization ────────────────────────────────────────────────────
const ENTITY_SUFFIX = new Set(["lp", "llc", "ltd", "inc", "corp", "company", "co"]);
const FUND_ROLE = new Set(["fund", "partners", "management", "advisors", "holdings", "ventures"]);
const FUND_ROLE_PHRASES = ["capital partners"];
const VEHICLE_WORDS = new Set(["annex", "overage", "parallel", "feeder", "master", "offshore", "onshore", "qp", "ai", "co-invest", "spv"]);
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
  let work = dedot(raw).toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const phrase of FUND_ROLE_PHRASES) {
      if (work.endsWith(" " + phrase) || work === phrase) { work = work.slice(0, work.length - phrase.length).trim(); changed = true; }
    }
    const tokens = work.split(" ");
    const last = tokens[tokens.length - 1];
    if (last && (ENTITY_SUFFIX.has(last) || FUND_ROLE.has(last) || VEHICLE_WORDS.has(last) || ROMAN.has(last) || ORDINALS.has(last) || /^\d{4}$/.test(last))) {
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
