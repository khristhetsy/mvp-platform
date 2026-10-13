import {
  DANIELA_AI_LINES,
  DANIELA_COST_LINES,
  DANIELA_COST_VARIANTS,
  DANIELA_FACTS,
  DANIELA_FALLBACK_LINES,
  DANIELA_OBJECTIONS,
  type DanielaChoice,
} from "./config";
import type { JessicaProfile } from "@/lib/jessica/flow";
import { checkOf, isSideTalk, raiseOf, roleOf, stageOf, timingOf, TIMINGS } from "@/lib/jessica2/parse";

/**
 * Daniela's reply matching. Everything that does not depend on her wording
 * (slot grouping, the name guard, AI mode, the time offer line,
 * the AI reply parser) is Jessica's, re-exported so the two cannot drift.
 */
export {
  aiMode,
  formatSlotWhen,
  groupSlotsByDay,
  looksLikeName,
  parseAiReply,
  pickWording,
  questionKey,
  timeOfferLine,
  validEmail,
} from "@/lib/jessica/flow";
export type {
  DayGroup,
  DaySlot,
  JessicaAiMode as DanielaAiMode,
  JessicaAiReply as DanielaAiReply,
  Slot,
} from "@/lib/jessica/flow";

export { industryOf, isSideTalk } from "@/lib/jessica2/parse";

/** What Daniela has learned about the visitor. The founder fields mirror Jessica 2.0's profile, with industry added. */
export interface DanielaProfile extends JessicaProfile {
  /** Industry in the founder's own words, or the plain label for it. */
  industry?: string;
}

/** Intake answers saved on the booking, in the order Daniela asks them. Empty answers are left out. */
export function bookingAnswers(profile: DanielaProfile): Array<{ label: string; value: string }> {
  const rows: Array<[string, string | undefined]> = [
    ["Raising or investing", profile.role],
    ["Company stage", profile.stage],
    ["Industry", profile.industry],
    ["Raise size", profile.raise],
    ["Time to close", profile.timing],
    ["Check size", profile.checkSize],
    ["Capital type", profile.capitalType],
  ];
  return rows
    .filter((row): row is [string, string] => Boolean(row[1]?.trim()))
    .map(([label, value]) => ({ label, value: value.trim().slice(0, 1000) }));
}

export type ProfileStep = "role" | "check" | "stage" | "industry" | "raise" | "timing";

/**
 * The next profile field the visitor has not given, or null when the profile is
 * complete. Founders: stage, industry, raise size, timing. Investors: check size.
 * Daniela fills every gap before a call is booked, so the team never gets an empty intake.
 */
export function missingProfileStep(profile: DanielaProfile): ProfileStep | null {
  if (!profile.role) return "role";
  if (profile.role === "Investing") return profile.checkSize ? null : "check";
  if (!profile.stage) return "stage";
  if (!profile.industry) return "industry";
  if (!profile.raise) return "raise";
  if (!profile.timing) return "timing";
  return null;
}

/**
 * Read a typed answer as one of the chips for that question, using Jessica 2.0's
 * parsers. Null when it is a question or objection (side talk), or when the text
 * does not say which chip it means. Then the chat answers it and asks again.
 */
export function optionFor(kind: "role" | "stage" | "raise" | "timing" | "check", text: string, options: string[]): string | null {
  if (isSideTalk(text)) return null;
  const starts = (label: string) => options.find((o) => label.toLowerCase().startsWith(o.toLowerCase())) ?? null;
  if (kind === "role") {
    const role = roleOf(text);
    return role === "Raising" ? (options[0] ?? null) : role === "Investing" ? (options[1] ?? null) : role === "more" ? (options[2] ?? null) : null;
  }
  if (kind === "stage") {
    const stage = stageOf(text);
    return stage && stage !== "revenue" ? starts(stage) : null;
  }
  if (kind === "raise") {
    const raise = raiseOf(text);
    return raise ? starts(raise) : null;
  }
  if (kind === "check") {
    const check = checkOf(text);
    return check ? starts(check) : null;
  }
  const timing = timingOf(text);
  const index = timing ? TIMINGS.indexOf(timing) : -1;
  return index >= 0 ? (options[index] ?? null) : null;
}

/** Map a chip the visitor tapped to the two paths the conversation takes. */
export function normalizeRole(choice: string): "Raising" | "Investing" {
  return /invest|deals/i.test(choice) ? "Investing" : "Raising";
}

export type DanielaReply =
  | { kind: "cost"; id: "cost"; lines: string[]; variants: string[][] }
  | { kind: "ai"; lines: string[] }
  | { kind: "objection"; id: string; lines: string[]; variants: string[][]; choices?: Record<string, DanielaChoice>; bridge?: string; repeatBridge?: string }
  | { kind: "fact"; id: string; lines: string[]; variants: string[][] }
  | { kind: "unknown"; lines: string[] };

const COST = /\b(cost|costs|price|pricing|fee|fees|charge|charges|how much|upfront|up front|retainer)\b/i;
const AI = /\b(bot|robot|ai|a\.i\.|chatgpt|automated|human|real person|actual person|a person)\b/i;

/**
 * Pick the answer for something the visitor typed. Honest by design: asked
 * whether she is a bot or a person, Daniela says she is an AI assistant.
 *
 * Order matters. Money, trust and objection replies come before the generic
 * cost test, and the generic cost test comes before the process and fact
 * matchers, so "how do you get paid" is a fee answer and not a process answer.
 */
export function matchReply(text: string): DanielaReply {
  if (AI.test(text)) return { kind: "ai", lines: DANIELA_AI_LINES };
  for (const objection of DANIELA_OBJECTIONS) {
    if (objection.match.test(text)) {
      return {
        kind: "objection",
        id: objection.id,
        lines: objection.lines,
        variants: objection.variants ?? [],
        choices: objection.choices,
        bridge: objection.bridge,
        repeatBridge: objection.repeatBridge,
      };
    }
  }
  if (COST.test(text)) return { kind: "cost", id: "cost", lines: DANIELA_COST_LINES, variants: DANIELA_COST_VARIANTS };
  for (const fact of DANIELA_FACTS) {
    if (fact.match.test(text)) return { kind: "fact", id: fact.id, lines: fact.lines, variants: fact.variants ?? [] };
  }
  return { kind: "unknown", lines: DANIELA_FALLBACK_LINES };
}
