/**
 * Saying what is actually in the way.
 *
 * The founder dashboard used to read one boolean off the CRR — outreach ready
 * or not — and then suggest an unrelated task. A founder held at 51 was told to
 * open a data room, which is a real job but not the one stopping them, and the
 * number that caused it was never shown.
 *
 * Pure: the copy is decided here so it can be tested without a database, and so
 * the same sentence can appear on the dashboard, the stage guide and the
 * matches page without three of them drifting.
 */

export type BlockerDimension = {
  label: string;
  /** 0–100 within the dimension. */
  score: number;
  /** Points this dimension carries at the company's own stage. */
  weight: number;
  /** Points still on the table if it reached 100. */
  headroom: number;
};

export type CrrSummary = {
  score: number | null;
  gate: number;
  pointsToGate: number;
  outreachUnlocked: boolean;
  dimensions: BlockerDimension[];
};

/**
 * The dimensions worth working on, strongest lever first.
 *
 * Ranked by headroom, not by how low the dimension scores: at Seed a cap table
 * at 20% is worth more than a narrative at 20%, because the weights differ.
 * A dimension already at 100 has nothing left to give and is left out.
 */
export function weakestDimensions(dims: BlockerDimension[], take = 2): BlockerDimension[] {
  return [...dims]
    .filter((d) => d.headroom > 0.05)
    .sort((a, b) => b.headroom - a.headroom || a.score - b.score)
    .slice(0, Math.max(0, take));
}

/** "Cap table and traction" / "Cap table" / "" */
export function namesOf(dims: BlockerDimension[]): string {
  const names = dims.map((d) => d.label);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export type Blocker = {
  title: string;
  description: string;
  /** For a progress bar: where the score sits, and where the gate does. */
  score: number;
  gate: number;
};

/**
 * What is holding outreach, in words.
 *
 * Returns null when nothing is: an unlocked founder, or one who has never been
 * scored — telling somebody their score is 0 when nobody has looked is worse
 * than saying nothing.
 */
export function outreachBlocker(crr: CrrSummary): Blocker | null {
  if (crr.outreachUnlocked) return null;
  if (crr.score === null) return null;

  const weakest = weakestDimensions(crr.dimensions, 2);
  const names = namesOf(weakest);
  const detail = weakest
    .map((d) => `${d.label.toLowerCase()} ${Math.round((d.score * d.weight) / 100)} of ${Math.round(d.weight)}`)
    .join(", ");

  return {
    title: `Your CRR is ${crr.score} — outreach unlocks at ${crr.gate}`,
    description: names
      ? `${names} are costing you the most: ${detail}.`
      : `You are ${crr.pointsToGate} point${crr.pointsToGate === 1 ? "" : "s"} away.`,
    score: crr.score,
    gate: crr.gate,
  };
}

/** One line for a chip or a status column: "CRR 51 · gate 65". */
export function gateChip(crr: CrrSummary): string {
  if (crr.score === null) return "CRR not scored yet";
  return crr.outreachUnlocked
    ? `CRR ${crr.score} · outreach open`
    : `CRR ${crr.score} · gate ${crr.gate}`;
}
