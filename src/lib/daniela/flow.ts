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

/**
 * Daniela's reply matching. Everything that does not depend on her wording
 * (slot grouping, booking answers, the name guard, AI mode, the time offer line,
 * the AI reply parser) is Jessica's, re-exported so the two cannot drift.
 */
export {
  aiMode,
  bookingAnswers,
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
  JessicaProfile as DanielaProfile,
  Slot,
} from "@/lib/jessica/flow";

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

export type QualifyingStep = "role" | "check" | "stage" | "raise" | "timing";

/**
 * The next qualifying question the visitor has not answered, or null when
 * everything is known. Used when a time offer was ignored: Daniela asks this
 * instead of pushing the times again.
 */
export function nextQualifyingStep(profile: JessicaProfile): QualifyingStep | null {
  if (!profile.role) return "role";
  if (profile.role === "Investing") return profile.checkSize ? null : "check";
  if (!profile.stage) return "stage";
  if (!profile.raise) return "raise";
  if (!profile.timing) return "timing";
  return null;
}
