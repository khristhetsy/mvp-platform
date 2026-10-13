/**
 * Scripted replies shared by every founder IR agent. The flow (hard stop, the no
 * ladder, stalls, the AI question) comes from Johnny. The fixed answers about
 * iCFO's fees and licensing do not: a founder is not iCFO, so a founder agent
 * answers questions only from what the founder taught it.
 */
import { isQuestion } from "@/lib/johnny/config";
import type { TaughtAnswer } from "./types";

export type AgentScripted =
  | { kind: "stop" }
  | { kind: "no" }
  | { kind: "stall" }
  | { kind: "toomany" }
  | { kind: "ai" }
  | { kind: "later" }
  | { kind: "dealsize" }
  | { kind: "taught"; answer: string };

export const HARD_STOP_RE = /unsubscribe|remove me|take me off|stop (emailing|contacting|messaging|texting)|do not contact|don'?t (contact|message|email)|leave me alone/;

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "do", "does", "you", "your", "i", "we", "it", "of", "to", "in", "on", "for", "and", "or",
  "what", "how", "who", "when", "where", "why", "can", "could", "will", "would", "me", "my", "this", "that", "with", "about",
  "have", "has", "be", "any", "there", "us", "our", "they", "them", "from", "at", "by", "as", "if", "so", "please", "tell",
  "company", "guys", "all", "just", "really", "much",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, ""));
}

/**
 * The taught answer whose question best matches the message, or null. A match
 * needs at least two shared content words, or one when the taught question has
 * only one, and more than half of the taught question's words.
 */
export function taughtAnswerFor(text: string, taught: TaughtAnswer[]): TaughtAnswer | null {
  const asked = new Set(tokens(text));
  if (!asked.size) return null;
  let best: { hit: TaughtAnswer; score: number } | null = null;
  for (const t of taught) {
    const q = [...new Set(tokens(t.question))];
    if (!q.length) continue;
    const shared = q.filter((w) => asked.has(w)).length;
    const need = q.length <= 1 ? 1 : 2;
    if (shared < need || shared / q.length < 0.5) continue;
    const score = shared / q.length + shared / 10;
    if (!best || score > best.score) best = { hit: t, score };
  }
  return best?.hit ?? null;
}

/** What a message asks of the agent before it is read as an answer. */
export function matchAgent(text: string, taught: TaughtAnswer[]): AgentScripted | null {
  const l = text.toLowerCase().trim();
  if (HARD_STOP_RE.test(l)) return { kind: "stop" };
  if (/not interested|no thanks|no thank you|not for me|i'?ll pass|\bpass\b|not looking|not investing( right)? now|not a fit|^no\.?$|^nope\.?$|^nah\.?$/.test(l)) return { kind: "no" };
  if (/check with|run it by|(talk to|ask|discuss with) (my )?(partners?|team|committee|board|wife|husband)|think about it|sleep on it/.test(l)) return { kind: "stall" };
  if (/too many (questions|steps)|so many questions|enough questions|stop asking|skip (the )?questions/.test(l)) return { kind: "toomany" };
  if (/\b(bot|robot|ai|human|real person|automated)\b/.test(l) && /\?|are you|r u|is this/.test(l)) return { kind: "ai" };
  if (/deal ?(size|suze|sise|sizes)|size of (the )?(deals?|rounds?)|how big (are |is )?(the )?(deals?|rounds?)|round sizes?|raise sizes?/.test(l)) return { kind: "dealsize" };
  if (isQuestion(text)) {
    const hit = taughtAnswerFor(text, taught);
    if (hit) return { kind: "taught", answer: hit.answer };
  }
  if (/not now|maybe later|busy|next week/.test(l)) return { kind: "later" };
  return null;
}

/** Lines founders cannot change. {{company}} is replaced by the page. */
export const AGENT_LINES = {
  optOut: ["Understood, and thank you for telling me directly.", "I will not follow up with you. If that changes, you are always welcome here."],
  stopped: "Thank you. Your preference is noted and I will not contact you again.",
  fallback: "I would prefer to go over that with you on the call.",
  noLadder: {
    columbo: [
      "Understood. One more thing before you go: it's 30 minutes, and you only hear about it if it fits your mandate.",
      "I hear you. Just so you know, it's a short call, and only if {{company}} fits how you invest.",
    ],
    backwards: ["Fair enough. So I don't waste your time later: what would make a deal worth a look for you?", "Totally fair. What kind of deal would make you take the call?"],
    thesisThanks: ["That's helpful, thank you.", "Good to know, thank you."],
    thesisLead: "Let's put 30 minutes on it, and we keep it to what fits.",
    later: "No problem if now isn't the time.",
    keep: ["Understood, I'll leave it there.", "If something at {{company}} fits how you invest, can I reach out?"],
    keepYes: ["Thank you. I'll only reach out when it fits your mandate.", "Talk soon."],
    goodbye: ["Of course. Thank you for your time, and you are always welcome here."],
  },
  stall: ["Of course. Bring them on the call, it's easier for everyone to hear the same thing.", "Makes sense. Invite them along, we'll walk everyone through it together."],
  idle: ["Are you still there?", "Still with me? Happy to pick up where we left off."],
  ai: [
    ["I'm an AI assistant for the {{company}} team, and there's nothing here I can't help you with.", "Would you like someone from the team to talk with you?"],
    ["Still an AI assistant for {{company}}, and still here for whatever you need.", "Shall I set you up with someone from the team?"],
  ],
  dealSize: {
    ask: ["It depends on the round. Tell me your typical check and I'll make sure what we send fits it.", "The round is set by the team. Your typical check is what tells us whether it fits."],
    plain: ["The team covers the round on the call.", "That's one for the call with the team."],
  },
  acks: ["Got it, thank you.", "Understood.", "Right."],
  thanks: ["Thank you.", "Understood.", "That helps.", "Good to know."],
  noFields: ["I want to be sure I follow you. Tell me a little more about how you invest.", "Thank you. Tell me a bit more about how you invest, and I will take it from there."],
  confirm: ["Did I get that right?", "Is that right?", "Have I got that right?"],
  leads: ["Back to you: ", "Anyway, ", "So, "],
  hints: {
    type: ["Angel, family office, venture fund, something else?", "Is it your own money, or a fund or family office?"],
    sect: ["Just the industry is fine. Software, healthcare, energy, something else?", "Which industries? Type them in, any you like."],
    check: ["A rough range is fine, like 100K or 1M.", "Roughly, what does a typical check look like?"],
    stage: ["Pre-seed, seed, Series A, later?", "Early stage, or later?"],
    cap: ["Equity, SAFEs, notes, debt?", "Equity, or debt too?"],
  },
} as const;

export function fill(line: string, vars: { company: string; name: string }): string {
  return line.replaceAll("{{company}}", vars.company).replaceAll("{{name}}", vars.name);
}
