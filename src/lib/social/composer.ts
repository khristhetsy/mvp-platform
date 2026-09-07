/**
 * Composer — turn a raw "what happened" brief into a per-account LinkedIn draft
 * (build-spec §9). The brief is notes, not a topic: raw notes produce a specific
 * post, a topic produces filler. Variants are rewritten per account, never copied.
 */

import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";

export const ARCHETYPES = [
  { key: "proof_case", label: "Proof case" },
  { key: "teardown", label: "Teardown" },
  { key: "named_ask", label: "Named ask" },
] as const;
export type Archetype = (typeof ARCHETYPES)[number]["key"];

const ARCHETYPE_GUIDE: Record<Archetype, string> = {
  proof_case: "A concrete result or moment that proves a point. Open with the specific, show what happened, end on the lesson.",
  teardown: "Dissect what went wrong or right in a real situation — the mistakes, the fix, what to copy or avoid.",
  named_ask: "State a clear, specific ask (who you want to hear from and why). Direct, not needy.",
};

/** Draft one account's variant from the brief. Falls back to a plain template when
 *  the AI isn't configured, so the composer always returns something editable. */
export async function draftVariant(input: { brief: string; archetype: Archetype; accountName: string }): Promise<string> {
  const guide = ARCHETYPE_GUIDE[input.archetype] ?? "";
  if (!isClaudeConfigured()) {
    return `${input.brief.trim()}\n\n(Draft for ${input.accountName} — connect AI to generate voice-matched copy.)`;
  }
  const system = [
    "You write LinkedIn posts for a founder/operator in a private-capital business, in their own plain, direct voice.",
    "No hashtags, no emojis, no corporate filler. Short lines. First line is a hook that stands alone.",
    "Do NOT include any link in the body — the link goes in the first comment.",
    `Archetype: ${input.archetype}. ${guide}`,
    `This variant is for the account "${input.accountName}" — write it fresh in that person's voice; never reuse copy across accounts.`,
  ].join("\n");
  const reply = await claudeComplete(
    [{ role: "user", content: `Write the post from these raw notes (what actually happened):\n\n${input.brief}` }],
    { model: CLAUDE_SONNET, system, maxTokens: 500, temperature: 0.7 },
  );
  return reply.trim() || input.brief.trim();
}
