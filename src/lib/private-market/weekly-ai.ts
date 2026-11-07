/**
 * Pure helpers for the weekly emailer AI writer: which facts an admin can tick,
 * the prompt, and the checks every option must pass before it is shown.
 * No database access and no model call here (see weekly-ai-server.ts).
 *
 * The rule that matters: the writer may only use figures that are in the ticked
 * facts, the admin's own extra line, or (for a rewrite) the text being rewritten.
 * A figure outside that set drops the option.
 */
import { MERGE_FIELDS, type Audience } from "./weekly-email";
import type { DigestMarket } from "./weekly-digest";

export type FactKey = "approved" | "moves" | "market" | "gainer" | "sector" | "recipient";

export type FactOption = { key: FactKey; label: string; text: string; defaultOn: boolean };

export const TARGETS = ["subject", "preheader", "note"] as const;
export type Target = (typeof TARGETS)[number];
export const TARGET_LIMIT: Record<Target, number> = { subject: 100, preheader: 150, note: 600 };
const TARGET_LABEL: Record<Target, string> = { subject: "subject line", preheader: "preheader (the preview text next to the subject)", note: "short note shown at the top of the email" };

export const TONES = ["friendly", "formal", "persuasive"] as const;
export type Tone = (typeof TONES)[number];
const TONE_TEXT: Record<Tone, string> = {
  friendly: "warm and friendly, while staying professional",
  formal: "formal and polished, in a professional business tone",
  persuasive: "persuasive and compelling, inviting the reader to open the board",
};

export const REWRITES = ["formal", "friendly", "persuasive", "shorten", "expand", "polish"] as const;
export type RewriteAction = (typeof REWRITES)[number];
const REWRITE_TEXT: Record<RewriteAction, string> = {
  formal: "more formal and polished",
  friendly: "warmer and friendlier while staying professional",
  persuasive: "more persuasive, with a clear reason to open the board",
  shorten: "significantly shorter, keeping only the key points",
  expand: "a little more detailed, without adding any new facts or figures",
  polish: "corrected for spelling, grammar and awkward phrasing, without changing the meaning",
};

/** The default writer's name, also used for the sign off when no agent is picked. */
export const DEFAULT_WRITER_NAME = "The iCapOS team";

const pct = (v: string | null) => (v ? ` (${v})` : "");

/** The facts an admin can tick, built only from this week's real platform numbers. */
export function factOptions(market: DigestMarket, audience: Audience): FactOption[] {
  const out: FactOption[] = [];
  const n = market.newlyApproved;
  out.push({
    key: "approved",
    label: "Newly approved",
    text: `${n.count} ${n.count === 1 ? "company was" : "companies were"} approved in the last 7 days, ${n.scored} already ${n.scored === 1 ? "has" : "have"} a rating. ${market.approvedTotal} are approved in total.`,
    defaultOn: true,
  });
  if (market.moves.length > 0) {
    const top = market.moves.slice(0, 3).map((m) => (m.from === null ? `${m.symbol} newly rated ${m.to}` : `${m.symbol} moved from ${m.from} to ${m.to}`));
    out.push({ key: "moves", label: "Rating moves", text: `Rating moves this week: ${top.join(", ")}.`, defaultOn: true });
  }
  const tiles = market.tiles.map((t) => `${t.label.toLowerCase()} ${t.value}${pct(t.delta)}`);
  if (tiles.length > 0) out.push({ key: "market", label: "The market", text: `The market this week: ${tiles.join(", ")}.`, defaultOn: true });
  const g = market.gainers[0];
  if (g) out.push({ key: "gainer", label: "Top gainer", text: `Top gainer since first reading: ${g.symbol}, up ${g.change} points to a rating of ${g.crr}.`, defaultOn: false });
  const sec = market.sectors[0];
  if (sec) out.push({ key: "sector", label: "Sector leader", text: `Top sector by average rating: ${sec.sector} at ${sec.avg.toFixed(1)}.`, defaultOn: false });
  out.push(
    audience === "founder"
      ? { key: "recipient", label: "The recipient's own rating", text: "The reader's own rating and band are filled in for each person. Use the merge fields {rating} and {band} where it fits. Never write a number for them.", defaultOn: false }
      : { key: "recipient", label: "Approved company count", text: "The number of newly approved companies is filled in for each email. Use the merge field {approved} where it fits.", defaultOn: false },
  );
  return out;
}

/** Every number written in text, with thousands commas removed ("1,640.0" becomes "1640.0"). */
export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = m[0].replace(/,+$/, "").replace(/,/g, "");
    out.add(raw);
    if (raw.includes(".")) out.add(String(Number(raw)));
  }
  return out;
}

const MERGE_SET = new Set<string>(MERGE_FIELDS);

/** Dashes are not used as sentence punctuation in iCFO copy. */
export function cleanDashes(text: string): string {
  return text.replace(/\s+[—–]\s+/g, ", ").replace(/\s+-\s+/g, ", ").replace(/[—–]/g, ", ").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
}

export type OptionCheck = { ok: true; text: string } | { ok: false; reason: string };

/** One option must be inside the length, use only allowed figures and keep to the three merge fields. */
export function checkOption(raw: string, allowed: Set<string>, limit: number, mustKeep: string[] = []): OptionCheck {
  const text = cleanDashes(raw.replace(/^["'\s]+|["'\s]+$/g, ""));
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > limit) return { ok: false, reason: "too long" };
  for (const n of numbersIn(text.replace(/\{[a-z]+\}/g, ""))) if (!allowed.has(n)) return { ok: false, reason: `figure ${n} is not in the facts` };
  for (const f of text.match(/\{[^}]*\}/g) ?? []) if (!MERGE_SET.has(f)) return { ok: false, reason: `unknown field ${f}` };
  for (const f of mustKeep) if (!text.includes(f)) return { ok: false, reason: `lost ${f}` };
  return { ok: true, text };
}

/** Pulls {"options":[...]} out of a model reply, tolerating code fences. */
export function parseOptions(raw: string): string[] {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const j = JSON.parse(body.slice(start, end + 1)) as { options?: unknown };
    return Array.isArray(j.options) ? j.options.filter((o): o is string => typeof o === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

export const WRITER_RULES =
  "Write for the Private Market weekly email that iCFO Capital Global sends from iCapOS. Use only the facts you are given. Never invent a figure, name, date, company or commitment, and never mention a number that is not in the facts. Do not promise funding or returns, and do not give investment advice. No dashes used as sentence punctuation, no bullet points, no emojis. The only placeholders you may write are {rating}, {band} and {approved}, and only when the facts say to.";

export const DEFAULT_PERSONA = "You are the iCapOS email writing assistant for iCFO Capital Global. You write clear, warm, professional business emails.";

export function writeTask(input: { target: Target; tone: Tone; facts: FactOption[]; extra: string; audience: Audience }): string {
  const who = input.audience === "founder" ? "founders on the platform" : "approved investors on the platform";
  return [
    `Write 3 different options for the ${TARGET_LABEL[input.target]} of this week's email to ${who}.`,
    `Tone: ${TONE_TEXT[input.tone]}.`,
    `Each option must be ${TARGET_LIMIT[input.target]} characters or fewer.`,
    input.target === "note" ? "Write plain text in one or two short paragraphs. No greeting line and no sign off." : "Write one line of plain text, with no quotation marks.",
    "",
    "FACTS you may use (and the only figures you may mention):",
    ...input.facts.map((f) => `- ${f.text}`),
    input.extra.trim() ? `\nThe sender also wants this included, in their words: ${input.extra.trim()}` : "",
    "",
    'Output STRICT JSON only: {"options":["option 1","option 2","option 3"]}.',
  ].filter((l) => l !== "").join("\n");
}

export function rewriteTask(input: { action: RewriteAction; text: string }): string {
  return `Rewrite the text below to be ${REWRITE_TEXT[input.action]}. Keep every figure, name, date and placeholder such as {rating} exactly as written. Add nothing new. Output STRICT JSON only: {"options":["the rewritten text"]}.\n\n---\n${input.text}`;
}

/** Figures the admin typed in the extra line count as theirs. */
export function allowedFigures(facts: FactOption[], extra: string): Set<string> {
  const set = new Set<string>();
  for (const f of facts) for (const n of numbersIn(f.text.replace(/\{[a-z]+\}/g, ""))) set.add(n);
  for (const n of numbersIn(extra)) set.add(n);
  return set;
}
