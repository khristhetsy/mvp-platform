/**
 * Words and claims the sales AI agent must never write in its own voice.
 *
 * These come from khris's standing rules for iCapOS sales copy: no free offer,
 * no network figures, no word that assures a result, no dashes in sentences,
 * and the current product name, iCapOS, rather than the old one. The prospect's own quoted words are exempt (a
 * prospect may well write "free"), so callers pass only the agent's written text.
 */

import { phraseRegex } from "./skip";

const RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: "guarantee", pattern: /guarantee/i },
  { name: "risk free", pattern: /risk[\s-]?free/i },
  { name: "free offer", pattern: /\bfree\b/i },
  { name: "no credit card", pattern: /\bno credit card\b/i },
  { name: "network figure", pattern: /\b7,?000\b|\b16\+?\s*years\b/i },
  { name: "outcome promise", pattern: /\b(we|you) will (get|be) (funded|funding)\b|\bwill fund\b|\bget you funded\b/i },
  { name: "dash", pattern: /[–—]|\s-\s/ },
  { name: "old product name", pattern: /capitalos/i },
];

/**
 * `extraBlocked` are words staff added in the training settings. They are checked as whole
 * words, ignoring case, on top of the built-in rules, which are always on.
 */
export function draftViolations(text: string, extraBlocked: string[] = []): string[] {
  const found = RULES.filter((r) => r.pattern.test(text)).map((r) => r.name);
  for (const word of extraBlocked) {
    const re = phraseRegex(word);
    if (re && re.test(text)) found.push(`banned word "${word.trim()}"`);
  }
  return found;
}
