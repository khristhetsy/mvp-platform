import type { CoachStep } from "@/lib/learning/course-types";
import { type CoachTone, TONE_LINES, toneInstruction } from "@/lib/learning/coach/tones";

export type DueChoice = "today" | "tomorrow" | "this_week";
export const DUE_CHOICES: readonly DueChoice[] = ["today", "tomorrow", "this_week"] as const;

export function isDueChoice(value: unknown): value is DueChoice {
  return typeof value === "string" && (DUE_CHOICES as readonly string[]).includes(value);
}

const PT = "America/Los_Angeles";

function ptParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    min: Number(p.minute),
    weekday: String(p.weekday),
  };
}

/** The UTC instant for a wall clock time in Pacific time (handles daylight saving). */
function ptWallToUtc(y: number, m: number, d: number, h: number): Date {
  for (const offsetHours of [7, 8]) {
    const guess = new Date(Date.UTC(y, m - 1, d, h + offsetHours, 0, 0));
    const back = ptParts(guess);
    if (back.y === y && back.m === m && back.d === d && back.h === h) return guess;
  }
  return new Date(Date.UTC(y, m - 1, d, h + 8, 0, 0));
}

/**
 * When a "Not now" commitment falls due, in Pacific time:
 * today 6:00 pm (or one hour from now if that has passed), tomorrow 9:00 am,
 * this week Friday 5:00 pm (next Friday when today is Friday evening or later).
 */
export function dueAtFor(choice: DueChoice, now: Date = new Date()): Date {
  const p = ptParts(now);
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d));
  const plusDays = (n: number) => {
    const t = new Date(base.getTime() + n * 86_400_000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  };
  if (choice === "today") {
    const evening = ptWallToUtc(p.y, p.m, p.d, 18);
    return evening.getTime() > now.getTime() ? evening : new Date(now.getTime() + 3_600_000);
  }
  if (choice === "tomorrow") {
    const t = plusDays(1);
    return ptWallToUtc(t.y, t.m, t.d, 9);
  }
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  let ahead = (5 - dow + 7) % 7;
  const fridayEvening = ptWallToUtc(plusDays(ahead).y, plusDays(ahead).m, plusDays(ahead).d, 17);
  if (ahead === 0 && fridayEvening.getTime() <= now.getTime()) ahead = 7;
  const t = plusDays(ahead);
  return ptWallToUtc(t.y, t.m, t.d, 17);
}

export type StepEventKind = "done" | "stuck" | "skipped";

export function isStepEventKind(value: unknown): value is StepEventKind {
  return value === "done" || value === "stuck" || value === "skipped";
}

/** Deterministic reply to a step check in. No AI call, so no AI usage is consumed. */
export function stepEventReply(input: {
  tone: CoachTone;
  event: StepEventKind;
  step: CoachStep;
  nextStep?: CoachStep | null;
}): string {
  const line = TONE_LINES[input.tone][input.event];
  if (input.event === "stuck") {
    const bits = [`You are on "${input.step.title}". Open ${input.step.menuPath.join(" › ")}.`];
    if (input.step.control) bits.push(`Use the ${input.step.control}.`);
    if (input.step.commonMistake) bits.push(`Common mistake: ${input.step.commonMistake}`);
    if (input.step.example) bits.push(`Example: ${input.step.example}`);
    return `${line} ${bits.join(" ")}`;
  }
  if (input.event === "done" && input.nextStep) {
    return `${line} Next: ${input.nextStep.title}.`;
  }
  return line;
}

/** Added to the existing class assistant prompt when the coach is active for this founder. */
export function buildCoachPromptAddendum(input: {
  tone: CoachTone;
  step: CoachStep | null;
  lessonTitle: string | null;
}): string {
  const lines = [
    "",
    "AI IR COACH MODE (the founder is enrolled in coaching):",
    toneInstruction(input.tone),
    "- Be aggressive about taking action and never about the person. Never shame, insult or guilt the founder.",
    "- Never promise or imply a funding outcome, investor response or timeline. Success is the actions the founder completes.",
    "- Draft, never decide. Suggest wording and times, and ask the founder to confirm before anything is saved to Tasks or Calendar.",
    "- Keep replies under 90 words and end with one concrete next action.",
  ];
  if (input.step) {
    lines.push(
      `Current step${input.lessonTitle ? ` in "${input.lessonTitle}"` : ""}: ${input.step.title}. ${input.step.instruction}`,
      `Menu path: ${input.step.menuPath.join(" › ")}.`,
    );
    if (input.step.commonMistake) lines.push(`Common mistake: ${input.step.commonMistake}`);
  }
  return lines.join("\n");
}

const SHAMING = /\b(lazy|pathetic|loser|stupid|useless|failure|you always|you never|disappointing)\b/i;
const PROMISES = /\b(guarantee[sd]?|will (?:definitely|certainly) (?:raise|close|get)|assured (?:funding|raise)|investors will (?:say yes|invest))\b/i;

/** Last line of defence on model output. Returns a safe fallback when a reply breaks the coach rules. */
export function enforceCoachRules(reply: string, tone: CoachTone): string {
  if (SHAMING.test(reply) || PROMISES.test(reply)) {
    return `${TONE_LINES[tone].skipped} Tell me which step you want to take next and when, and I will help you plan it.`;
  }
  return reply;
}
