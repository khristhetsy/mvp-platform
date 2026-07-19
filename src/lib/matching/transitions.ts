// Mutual-consent match state machine. Single source of truth for allowed
// transitions — every server action that mutates a match status must validate
// through here. Declines and expiry are terminal.

export type MatchStatus =
  | "suggested"
  | "investor_notified"
  | "investor_interested"
  | "founder_approved"
  | "introduced"
  | "declined_by_investor"
  | "declined_by_founder"
  | "expired";

/** Who is permitted to trigger a given transition. */
export type Actor = "system" | "investor" | "founder";

type Transition = { to: MatchStatus; by: Actor };

const ALLOWED: Record<MatchStatus, Transition[]> = {
  suggested: [
    { to: "investor_notified", by: "system" },
    { to: "expired", by: "system" },
  ],
  investor_notified: [
    { to: "investor_interested", by: "investor" },
    { to: "declined_by_investor", by: "investor" },
    { to: "expired", by: "system" },
  ],
  investor_interested: [
    { to: "founder_approved", by: "founder" },
    { to: "declined_by_founder", by: "founder" },
    { to: "expired", by: "system" },
  ],
  founder_approved: [
    { to: "introduced", by: "system" },
    { to: "expired", by: "system" },
  ],
  // Terminal states — no outgoing transitions.
  introduced: [],
  declined_by_investor: [],
  declined_by_founder: [],
  expired: [],
};

export function isTerminal(status: MatchStatus): boolean {
  return ALLOWED[status].length === 0;
}

export function canTransition(from: MatchStatus, to: MatchStatus, by?: Actor): boolean {
  return ALLOWED[from].some((t) => t.to === to && (by === undefined || t.by === by));
}

export class InvalidTransitionError extends Error {
  constructor(from: MatchStatus, to: MatchStatus, by?: Actor) {
    super(`Illegal match transition: ${from} → ${to}${by ? ` by ${by}` : ""}`);
    this.name = "InvalidTransitionError";
  }
}

/** Throws InvalidTransitionError if the transition is not allowed. */
export function assertTransition(from: MatchStatus, to: MatchStatus, by?: Actor): void {
  if (!canTransition(from, to, by)) throw new InvalidTransitionError(from, to, by);
}

/** The statuses shown to an investor as anonymized cards (pre-introduction). */
export const PRE_INTRODUCTION_STATUSES: MatchStatus[] = [
  "investor_notified",
  "investor_interested",
  "founder_approved",
];
