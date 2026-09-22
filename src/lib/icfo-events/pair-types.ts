/**
 * Which pairings an event matches, and how strong each match is.
 *
 * The board used to pair everybody with everybody: at an event with 101
 * investors and 4 founders, 1,813 of the 2,217 matches were investor-to-
 * investor, while the invitation copy addressed the reader as an investor
 * being told about a founder. Staff now choose the pairings, and each kind
 * gets the message written for it.
 *
 * Pure. Which two people may meet is a rule, not a query.
 */

/** Everyone the matcher can see. Registrations carry the first four; presenters
 *  come from the event's own presenter list, not from a registration. */
export type Role = "investor" | "founder" | "service" | "sponsor" | "presenter";

export type PairTypeKey =
  | "investor_founder"
  | "investor_investor"
  | "presenter_investor"
  | "service_founder"
  | "sponsor_any"
  | "founder_founder";

export type PairType = {
  key: PairTypeKey;
  label: string;
  note: string;
  /** The two sides. `null` on the right means "anyone". */
  left: Role;
  right: Role | null;
  /** The invitation this pairing is written for. */
  template: "invitation" | "peer_invitation";
};

export const PAIR_TYPES: PairType[] = [
  {
    key: "investor_founder",
    label: "Investor ↔ Founder",
    note: "The introduction the invitation is written for.",
    left: "investor", right: "founder", template: "invitation",
  },
  {
    key: "investor_investor",
    label: "Investor ↔ Investor",
    note: "Peers who share sectors. Uses the peer invitation, not the founder one.",
    left: "investor", right: "investor", template: "peer_invitation",
  },
  {
    key: "presenter_investor",
    label: "Presenter ↔ Investor",
    note: "From the event's presenter list rather than its registrations.",
    left: "presenter", right: "investor", template: "invitation",
  },
  {
    key: "service_founder",
    label: "Service provider ↔ Founder",
    note: "Legal, banking, accounting — the advisor side of the room.",
    left: "service", right: "founder", template: "peer_invitation",
  },
  {
    key: "sponsor_any",
    label: "Sponsor ↔ anyone",
    note: "Sponsors paid to meet the room.",
    left: "sponsor", right: null, template: "peer_invitation",
  },
  {
    key: "founder_founder",
    label: "Founder ↔ Founder",
    note: "Peer founders in the same sector.",
    left: "founder", right: "founder", template: "peer_invitation",
  },
];

/** What an event matches when nobody has chosen — the two that carry the room. */
export const DEFAULT_PAIR_TYPES: PairTypeKey[] = ["investor_founder", "investor_investor"];

export function pairTypeFor(key: PairTypeKey): PairType | undefined {
  return PAIR_TYPES.find((p) => p.key === key);
}

/** Only keys we know, so a stale stored rule cannot widen the matching. */
export function sanitizeRules(raw: unknown): PairTypeKey[] {
  if (!Array.isArray(raw)) return DEFAULT_PAIR_TYPES;
  const known = new Set(PAIR_TYPES.map((p) => p.key));
  const out = raw.map(String).filter((k): k is PairTypeKey => known.has(k as PairTypeKey));
  return out.length ? [...new Set(out)] : [];
}

/**
 * The pairing two roles fall under, or null when they may not be matched.
 *
 * Order-insensitive: the board decides which side reads first, this only says
 * whether the pair exists and which message it gets.
 */
export function pairTypeOf(a: Role, b: Role, enabled: PairTypeKey[]): PairType | null {
  const on = new Set(enabled);
  for (const t of PAIR_TYPES) {
    if (!on.has(t.key)) continue;
    if (t.right === null) {
      if (a === t.left || b === t.left) return t;
      continue;
    }
    if ((a === t.left && b === t.right) || (a === t.right && b === t.left)) return t;
  }
  return null;
}

/**
 * The roles the enabled pairings can actually match.
 *
 * The pool tile means "people these rules could pair", not "everybody who
 * registered" — a sponsor in the room when no sponsor rule is on is not
 * matchable, and counting them would overstate the pool.
 */
export function matchableRoles(enabled: PairTypeKey[]): Set<Role> {
  const out = new Set<Role>();
  const on = new Set(enabled);
  for (const t of PAIR_TYPES) {
    if (!on.has(t.key)) continue;
    out.add(t.left);
    if (t.right) out.add(t.right);
    // "Anyone" on the right means every role is matchable through this rule.
    else for (const r of ["investor", "founder", "service", "sponsor", "presenter"] as Role[]) out.add(r);
  }
  return out;
}

export type ScoreBand = { score: number; label: string; count: number };

/**
 * How the matches are distributed by strength.
 *
 * The argument for a per-investor cap lives here: an event whose scores pile up
 * at the bottom is one where introducing everything turns a good list into
 * spam, and a bare total of 2,217 hides that completely.
 */
export function scoreBands(scores: number[]): ScoreBand[] {
  const counts = new Map<number, number>();
  for (const s of scores) counts.set(s, (counts.get(s) ?? 0) + 1);

  return [...counts]
    .sort((a, b) => b[0] - a[0])
    .map(([score, count]) => {
      // score = shared × 2 + 3 when the roles differ. An odd score carries the
      // cross-role bonus; an even one does not.
      const cross = score % 2 === 1;
      const shared = Math.floor((score - (cross ? 3 : 0)) / 2);
      return {
        score,
        label: shared > 0
          ? `${shared} shared sector${shared === 1 ? "" : "s"}${cross ? " + roles" : ""}`
          : "role only",
        count,
      };
    });
}

/** The middle score, for a "most of your matches look like this" line. */
export function medianScore(scores: number[]): number | null {
  if (!scores.length) return null;
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
