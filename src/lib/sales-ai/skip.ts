/**
 * Deal conversations are not subscription sales. When an opportunity's own
 * words or tags match a skip rule, the sales AI agent shows a notice and drafts
 * nothing: a person writes the email. Pure functions, no IO.
 */
import type { SkipResult, TrainingSettings } from "./training-types";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A phrase matches as whole words, ignoring case: "bridge" matches "a bridge round" but not "abridged". */
export function phraseRegex(phrase: string): RegExp | null {
  const p = phrase.trim().replace(/\s+/g, " ");
  if (p.length < 2) return null;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(p).replace(/ /g, "\\s+")}($|[^\\p{L}\\p{N}])`, "iu");
}

export type SkipInput = {
  title: string;
  tags: string[];
  /** Every piece of text on the opportunity: its notes, the thread, the chat. */
  texts: string[];
};

export function detectSkip(input: SkipInput, rules: Pick<TrainingSettings, "skipPhrases" | "skipTags">): SkipResult {
  const matched: string[] = [];
  const haystack = [input.title, ...input.texts].join("\n");
  for (const phrase of rules.skipPhrases) {
    const re = phraseRegex(phrase);
    if (re && re.test(haystack)) matched.push(`"${phrase.trim()}"`);
  }
  const have = new Set(input.tags.map((t) => t.trim().toLowerCase()));
  for (const tag of rules.skipTags) {
    if (tag.trim() && have.has(tag.trim().toLowerCase())) matched.push(`tag ${tag.trim()}`);
  }
  return matched.length ? { matched } : null;
}

export const SKIP_NOTICE = "This looks like a deal conversation, not a subscription sale. Draft it yourself.";

/** Cleans a list a person typed: trims, drops blanks and repeats (ignoring case), caps the length. */
export function cleanList(values: unknown, max: number, maxLen = 60): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const t = v.replace(/\s+/g, " ").trim().slice(0, maxLen);
    const key = t.toLowerCase();
    if (t.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
