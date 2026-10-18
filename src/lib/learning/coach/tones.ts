/**
 * AI IR Coach styles. All three are aggressive about ACTION and none shames the founder or
 * promises an outcome. Stored in coach_enrollments.tone and course_coach_config.tone.
 */
export const COACH_TONES = ["encouraging", "driven", "relentless"] as const;
export type CoachTone = (typeof COACH_TONES)[number];

/** Default style agreed with Khris on Oct 18, 2026. */
export const DEFAULT_COACH_TONE: CoachTone = "driven";

export function isCoachTone(value: unknown): value is CoachTone {
  return typeof value === "string" && (COACH_TONES as readonly string[]).includes(value);
}

export function coerceCoachTone(value: unknown): CoachTone {
  return isCoachTone(value) ? value : DEFAULT_COACH_TONE;
}

export const TONE_LABELS: Record<CoachTone, { label: string; blurb: string }> = {
  encouraging: { label: "Encouraging", blurb: "Warm and steady. Celebrates every step." },
  driven: { label: "Driven", blurb: "Direct and energetic. Pushes you to the next action." },
  relentless: { label: "Relentless", blurb: "Intense. Holds you to the time you chose." },
};

/** Fixed phrasing per style for events that need no AI call (done, stuck, not now, kept). */
export const TONE_LINES: Record<CoachTone, Record<"done" | "stuck" | "skipped" | "kept" | "missed", string>> = {
  encouraging: {
    done: "Nice work. That step is done, and every one you finish builds momentum.",
    stuck: "That is okay. Let's look at it together, one small piece at a time.",
    skipped: "No problem. Pick a time and I will help you come back to it.",
    kept: "You did what you said you would. That is how outreach habits are built.",
    missed: "That one slipped. Pick a new time and take the first small action today.",
  },
  driven: {
    done: "Done. Good. On to the next step while you have momentum.",
    stuck: "Let's fix that now. Here is where people usually get stuck and what to do.",
    skipped: "Fine, but not open ended. Choose a time now and I will hold you to it.",
    kept: "Kept. That is the standard. Keep going.",
    missed: "You missed it. Reset it for a time you will keep, and start today.",
  },
  relentless: {
    done: "Done is the only thing that counts. Next step, now.",
    stuck: "Stuck is a problem you can solve in minutes. Tell me exactly where, and we solve it.",
    skipped: "Delaying is a decision. Choose the time, and I will check on you at that time.",
    kept: "Kept. Raise the bar and take the next one.",
    missed: "Missed. No story needed. Choose the time and do the first action today.",
  },
};

export function toneInstruction(tone: CoachTone): string {
  switch (tone) {
    case "encouraging":
      return "Style: Encouraging. Warm, steady and specific. Celebrate the founder's real progress, then name one next action.";
    case "relentless":
      return "Style: Relentless. Intense, urgent and short. Hold the founder to the time they chose and ask for the next action every reply.";
    default:
      return "Style: Driven. Direct, energetic and action first. Acknowledge progress in one sentence, then push to the next action.";
  }
}
