/**
 * What to do next, worth what it is actually worth.
 *
 * The old wizard offered "+4 pts" for filling a profile field and "+6 pts" for
 * a document, against a target of 80. None of those numbers were real: the 4
 * corresponded to nothing in the formula it claimed to move, the 80 was a
 * literal in a template, and marking a step done only changed a number in the
 * browser until the page was reloaded.
 *
 * These steps are the CRR's own factors, ranked by the points each one still
 * has on the table at the company's own stage. "Up to", because a document is
 * scored on what it contains — uploading a cap table with nothing in it earns
 * nothing, and promising otherwise is how the last version lied.
 */

import type { FactorKey } from "@/lib/ai/readiness-scoring";

export type FactorGap = {
  key: FactorKey;
  label: string;
  /** Points earned and available at this stage — already in CRR points. */
  pts: number;
  max: number;
  /** The dimension this factor rolls into. */
  dimension: string;
};

export type ImprovementStep = FactorGap & {
  /** CRR points still on the table for this factor. */
  upTo: number;
  /** What the founder actually does. */
  action: string;
  href: string;
  /** Why this one is first. */
  why: string;
};

type Move = { action: string; href: string };

/**
 * The move behind each factor.
 *
 * One place, so the wizard, the remediation plan and the dimension drawer can
 * all name the same next step rather than three phrasings of it.
 */
const MOVES: Record<FactorKey, Move> = {
  revenue_cashflow:   { action: "Upload financial statements", href: "/founder/readiness/data-room" },
  customer_traction:  { action: "Add customer contracts or LOIs", href: "/founder/readiness/data-room" },
  founder_team:       { action: "Complete your team summary", href: "/founder/settings" },
  market_evidence:    { action: "Upload market research", href: "/founder/readiness/data-room" },
  unit_economics:     { action: "Add your unit economics", href: "/founder/financial-model" },
  governance_legal:   { action: "Upload incorporation and governance documents", href: "/founder/readiness/data-room" },
  ip_moat:            { action: "Document your IP and moat", href: "/founder/readiness/data-room" },
  burn_runway:        { action: "State your burn rate and runway", href: "/founder/financial-model" },
  exit_strategy:      { action: "Set out your exit strategy", href: "/founder/business-plan" },
  pitch_quality:      { action: "Improve your pitch deck", href: "/founder/pitch-deck" },
  deal_structure:     { action: "Describe your use of funds", href: "/founder/settings" },
  industry_alignment: { action: "Confirm your industry and stage", href: "/founder/settings" },
  impact_esg:         { action: "Add your impact or ESG position", href: "/founder/business-plan" },
};

/** The move for a factor, for anything that needs to name it outside a step. */
export function moveFor(key: FactorKey): Move {
  return MOVES[key];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Ranked steps, biggest gain first.
 *
 * A factor worth 15 at Series A and 3 at Pre-seed produces a different order
 * for two founders with identical documents — which is the point of a
 * stage-weighted rating.
 */
export function improvementSteps(gaps: FactorGap[], take = 5): ImprovementStep[] {
  return gaps
    .map((g) => ({ ...g, upTo: round1(Math.max(0, g.max - g.pts)) }))
    .filter((g) => g.upTo >= 0.5)
    .sort((a, b) => b.upTo - a.upTo || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, take))
    .map((g, i) => ({
      ...g,
      ...MOVES[g.key],
      why: i === 0
        ? `Your largest single gain — ${g.dimension.toLowerCase()} carries ${round1(g.max)} points at your stage.`
        : `Worth up to ${g.upTo} in ${g.dimension.toLowerCase()}.`,
    }));
}

/**
 * Whether these steps can carry the founder through the gate.
 *
 * Told plainly either way: a founder 14 points out whose entire remaining
 * headroom is 9 needs to know that re-scoring existing documents is not enough,
 * not to work through a list that cannot get there.
 */
export function reachesGate(steps: ImprovementStep[], pointsToGate: number): {
  enough: boolean;
  available: number;
  shortfall: number;
} {
  const available = round1(steps.reduce((sum, s) => sum + s.upTo, 0));
  return {
    enough: available >= pointsToGate,
    available,
    shortfall: round1(Math.max(0, pointsToGate - available)),
  };
}
