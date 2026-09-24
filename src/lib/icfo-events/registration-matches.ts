/**
 * Matches with other registrations, shown while someone registers and on the
 * confirmation screen.
 *
 * Uses the event's existing pairing rule (matching-rule.ts: shared sectors,
 * plus a bonus when a founder meets an investor). No new scoring. Only founder
 * and investor registrations take part, as on the networking board.
 *
 * Anonymous by design: a match carries the other person's role, their type and
 * the sectors they share with you. Never a name, company, email or phone.
 */

import { pairScore, sectorsOf, sharedSectors, type Matchable } from "@/lib/icfo-events/matching-rule";

export type MatchRole = Matchable["role"];

export type PoolEntry = {
  role: MatchRole;
  answers: Record<string, unknown>;
};

export type RegistrationMatch = {
  role: MatchRole;
  /** e.g. "Angel" for an investor, "Seed" for a founder; null when not given. */
  type: string | null;
  shared: string[];
  score: number;
  strength: "Strong" | "Match";
};

export function isMatchRole(v: unknown): v is MatchRole {
  return v === "founder" || v === "investor";
}

function typeOf(e: PoolEntry): string | null {
  const v = e.role === "investor" ? e.answers.investorType : e.answers.stage;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Everyone in the pool who matches `me`, strongest first. A pair with no shared
 * sector and the same role scores zero and is left out, exactly as the board does.
 */
export function rankMatches(me: Matchable, pool: PoolEntry[], limit = 20): RegistrationMatch[] {
  const out: RegistrationMatch[] = [];
  for (const e of pool) {
    const other: Matchable = { role: e.role, sectors: sectorsOf(e.answers) };
    const shared = sharedSectors(me, other);
    // The rule's complementary bonus alone would pair every founder with every
    // investor; a match here also needs at least one shared sector, so the list
    // says why each person is on it.
    if (shared.length === 0) continue;
    const score = pairScore(me, other);
    out.push({ role: e.role, type: typeOf(e), shared, score, strength: shared.length >= 2 && me.role !== e.role ? "Strong" : "Match" });
  }
  out.sort((a, b) => b.score - a.score || b.shared.length - a.shared.length);
  return out.slice(0, limit);
}
