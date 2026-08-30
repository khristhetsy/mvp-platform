// Form D Desk — Investor Mode · §7 Deal-event inference.
// Graded confidence, mirroring the v0.1 reconciliation cascade. 0.75 is the
// display threshold; the 0.55 tier is stored so a person can adjudicate, never so
// the count looks larger. Everything below 0.55 is computed, stored, never shown.
//
// Known blindness (the UI must state it): every non-board investor is invisible —
// this is a lead signal, not a cap table. Expect ~1 false positive in 5 at 0.75.

export const DEAL_DISPLAY_THRESHOLD = 0.75;

export type DealSignal = {
  /** Firm named in RECIPIENTS on the issuer filing — a named participant, not inference. */
  namedInRecipients: boolean;
  /** Exact identity_hash match on the issuer filing. */
  identityHashMatch: boolean;
  /** Name matches but a different address (weaker than a hash match). */
  nameMatch: boolean;
  /** The person is a Director on the issuer filing. */
  isDirector: boolean;
  /** Issuer filing post-dates the fund's first filing (temporal ordering holds). */
  issuerPostDatesFundFirstFiling: boolean;
};

/** Confidence in [0,1]. 0 means "below the 0.55 review floor — do not store as an event". */
export function dealEventConfidence(s: DealSignal): number {
  if (s.namedInRecipients) return 0.95;
  if (s.identityHashMatch && s.isDirector && s.issuerPostDatesFundFirstFiling) return 0.75;
  if (s.nameMatch && s.isDirector) return 0.55;
  return 0;
}

/** Whether a stored event is allowed to surface on the Desk. */
export function isDisplayableDeal(confidence: number): boolean {
  return confidence >= DEAL_DISPLAY_THRESHOLD;
}
