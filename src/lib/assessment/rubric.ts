// Pure scoring for the public assessment. Answers -> lead_prescore (0-100) ->
// score band. The band decides routing (§5.4): Foundation -> e-learning -> Basic,
// Emerging -> Basic, Ready -> Managed IR. Server-authoritative; unit-tested.

import { ASSESSMENT_QUESTIONS, ASSESSMENT_MAX_POINTS } from "@/lib/assessment/questions";

export type ScoreBand = "foundation" | "emerging" | "ready";
export type AssessmentAnswers = Record<string, string>;

export const BAND_ROUTING: Record<ScoreBand, { plan: "basic" | "managed_ir"; href: string; ctaLabel: string; viaLearning: boolean }> = {
  foundation: { plan: "basic", href: "/pricing", ctaLabel: "See how Basic works", viaLearning: true },
  emerging: { plan: "basic", href: "/start?plan=basic", ctaLabel: "Start on Basic", viaLearning: false },
  ready: { plan: "managed_ir", href: "/start?plan=managed_ir", ctaLabel: "Talk to us about Managed IR", viaLearning: false },
};

export const BAND_HEADLINES: Record<ScoreBand, string> = {
  foundation: "Foundation — there's real groundwork to lay before investors see you.",
  emerging: "Emerging — your fundamentals are landing. The next step is getting matched investors to see you.",
  ready: "Ready — you're in shape to go to market. This is where done-for-you distribution earns its keep.",
};

/** Foundation < 40, Emerging 40–69, Ready ≥ 70. */
export function bandFor(score: number): ScoreBand {
  if (score >= 70) return "ready";
  if (score >= 40) return "emerging";
  return "foundation";
}

/**
 * Score a full or partial answer set. Unanswered questions contribute 0, so the
 * server can score whatever was submitted without trusting a client-side total.
 */
export function scoreAssessment(answers: AssessmentAnswers): { leadPrescore: number; band: ScoreBand } {
  let raw = 0;
  for (const q of ASSESSMENT_QUESTIONS) {
    const chosen = answers[q.id];
    const opt = q.options.find((o) => o.id === chosen);
    if (opt) raw += opt.points;
  }
  const leadPrescore = Math.round((raw / ASSESSMENT_MAX_POINTS) * 100);
  return { leadPrescore, band: bandFor(leadPrescore) };
}
