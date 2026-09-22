/**
 * The one definition of "these two match".
 *
 * The staff board and the public event page both put a number on the same
 * thing, and a visitor comparing "2,217 matches" on the page with the board
 * would be right to expect them to agree. So the rule lives here once, and
 * both read it rather than each carrying a copy that drifts.
 */

import { normalizeSectors } from "@/lib/icfo-events/sectors";

export type Matchable = {
  role: "investor" | "founder";
  sectors: string[];
};

/** A shared sector is worth this much. */
const SECTOR_WEIGHT = 2;
/** An investor and a founder are worth meeting whatever they declared. */
const COMPLEMENTARY_BONUS = 3;

/**
 * The sectors someone declared at registration.
 *
 * Investors answer `sectors` (many), founders answer `sector` (one) — and the
 * form has changed over time, so both shapes are accepted from either.
 *
 * Returns slugs. Rows written before the two forms agreed hold labels, so the
 * value is resolved rather than compared as typed; otherwise an investor
 * registered by staff shares nothing with a founder who registered himself.
 */
export function sectorsOf(answers: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ["sectors", "sector"]) {
    const v = answers[key];
    if (Array.isArray(v)) out.push(...v.map(String));
    else if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return normalizeSectors(out);
}

/** The sectors both of them declared. */
export function sharedSectors(a: Matchable, b: Matchable): string[] {
  const mine = new Set(a.sectors);
  return b.sectors.filter((s) => mine.has(s));
}

/**
 * How strong a pair is. Zero means they are not a match at all.
 *
 * Note what this does *not* require: an investor and a founder who declared
 * nothing in common still score, because the room is the point. Two investors
 * only match on a shared sector.
 */
export function pairScore(a: Matchable, b: Matchable): number {
  const shared = sharedSectors(a, b).length;
  return shared * SECTOR_WEIGHT + (a.role !== b.role ? COMPLEMENTARY_BONUS : 0);
}

/**
 * How many pairs in this room match.
 *
 * Quadratic, and deliberately so: a 106-person event is ~5,500 comparisons,
 * which is nothing. It is counted rather than stored so that a registration
 * arriving five minutes ago is already in the number.
 */
export function countMatches(people: Matchable[]): number {
  let n = 0;
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      if (pairScore(people[i], people[j]) > 0) n += 1;
    }
  }
  return n;
}
