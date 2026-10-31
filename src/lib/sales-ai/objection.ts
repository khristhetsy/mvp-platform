/**
 * Objection type and the closing technique that goes with it.
 *
 * Rules, not a model: the same words always give the same answer, so a person
 * can read why the agent chose a technique. The technique names come from the
 * iCFO sales closing training. Priority order matters: a prospect who raises
 * cost and timing in one breath is treated as a money objection.
 */
import type { Objection } from "./types";

const RULES: Array<{ objection: Exclude<Objection, "unknown">; pattern: RegExp }> = [
  { objection: "ready", pattern: /\b(sign me up|send (me )?(the )?(link|contract|agreement)|let'?s (do it|get started|go)|i'?m ready|ready to (start|go|sign))\b/i },
  { objection: "team", pattern: /\b(my|our) (board|team|partner|co-?founders?|investors?|advisors?)\b|\bdiscuss (it |this )?with\b|\brun (it|this) by\b/i },
  { objection: "money", pattern: /\b(up ?front|pay(ing)? before|before (i|we) pay|budget|afford|expensive|too much|cost|price|pricing|fees?|cheaper|discount)\b/i },
  { objection: "timing", pattern: /\b(how long|timeline|when (can|will|do)|not now|next (quarter|month|year)|later|too soon|bad time|busy)\b/i },
  { objection: "value", pattern: /\b(not sure (it|this|that)|does (it|this) (really )?work|how does (it|this) work|what (exactly )?(is|are) (included|you|the)|what do you do|worth it|why (would|should) (i|we))\b/i },
  { objection: "fence", pattern: /\b(thinking (about|it over)|maybe|considering|on the fence|let me think|not decided|sounds (good|interesting))\b/i },
];

export function classifyObjection(texts: Array<string | null | undefined>): Objection {
  const joined = texts.filter((t): t is string => Boolean(t && t.trim())).join(" \n ");
  if (!joined) return "unknown";
  for (const rule of RULES) if (rule.pattern.test(joined)) return rule.objection;
  return "unknown";
}

/** Technique shown in the audit, named as in the sales training. */
export const TECHNIQUE: Record<Objection, string> = {
  value: "Backwards, Test Drive or Summary (questions 1, 14, 15)",
  money: "Question 3 or 12, then a Summary of the value",
  timing: "Questions 4 and 10. Now or Never only with a real deadline",
  team: "Question 11",
  fence: "Question close or Suggestion close",
  ready: "Assumptive close, question 13",
  unknown: "Backwards close: ask about their biggest struggle",
};

/** The one question the email ends with. */
export const CLOSING_QUESTION: Record<Objection, string> = {
  value: "Does that fit what you need?",
  money: "What would it take to move forward?",
  timing: "When do you want to decide and begin?",
  team: "How long have you been seeking capital, and how much have you raised so far?",
  fence: "Does that fit what you need?",
  ready: "Shall we get you started?",
  unknown: "What is your biggest struggle in raising capital right now?",
};
