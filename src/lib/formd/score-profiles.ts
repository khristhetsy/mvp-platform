// Form D Desk — Investor Mode · §8 Rating (one engine, two profiles).
// The scorer is parameterized, not duplicated — the same pattern as CRR's two
// stage-selected weighting profiles. Recency INVERTS between profiles (issuer:
// older is better = a stalled raise worth a call; investor: newer is better =
// actively deploying). That single fact is why the weights live in config, not in
// a function body. The existing issuer bucket scorer (scoreFormD) already embodies
// the issuer profile; this adds the shared config + the investor engine.

export type RecencyDirection = "older-better" | "newer-better";

export type ScoreProfile = {
  recencyWeight: number;
  recencyDirection: RecencyDirection;
  volumeWeight: number;
  fitWeight: number;
  typeWeight: number;
  positionWeight: number;
  reachWeight: number;
};

// §8.1 — weights per profile. Only recency direction differs in kind; the weight
// splits differ in degree.
export const SCORE_PROFILES: Record<"issuer" | "investor", ScoreProfile> = {
  issuer: {
    recencyWeight: 0.25,
    recencyDirection: "older-better",
    volumeWeight: 0.25,
    fitWeight: 0.15,
    typeWeight: 0.15,
    positionWeight: 0.1,
    reachWeight: 0.1,
  },
  investor: {
    recencyWeight: 0.25,
    recencyDirection: "newer-better",
    volumeWeight: 0.2,
    fitWeight: 0.2,
    typeWeight: 0.15,
    positionWeight: 0.1,
    reachWeight: 0.1,
  },
};

/** Recency signal in [0,1], direction-aware. `days` is days since the filing /
 *  deployment. Older-better rises with age; newer-better falls with age. Same
 *  input, opposite profiles → opposite ordering (acceptance test 15). */
export function recencySignal(days: number, direction: RecencyDirection, horizonDays = 730): number {
  const clamped = Math.max(0, Math.min(days, horizonDays));
  const fresh = 1 - clamped / horizonDays; // 1 when brand new, 0 at the horizon
  return direction === "newer-better" ? fresh : 1 - fresh;
}

export type ScoreSignals = {
  recencyDays: number;
  volume: number; // 0..1
  fit: number; // 0..1
  type: number; // 0..1
  position: number; // 0..1
  reach: number; // 0..1
};

/** Weighted 0..100 score for a profile. Recency is resolved by direction; the
 *  other signals are pre-normalized 0..1 by the caller. */
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

// §8.2 — bands gate the score. A registry firm renders "verified — no observed
// activity", never a number: rating 75% of the register on type + geography alone
// produces a distribution that can't order a queue.
export type ActivityBand = "observed" | "single" | "registry";

export function activityBand(investments24mo: number): ActivityBand {
  if (investments24mo >= 2) return "observed";
  if (investments24mo === 1) return "single";
  return "registry";
}

/** Whether a numeric rank may be shown for this band (registry → never). */
export function bandShowsRank(band: ActivityBand): boolean {
  return band !== "registry";
}
