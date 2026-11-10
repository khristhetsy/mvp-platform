/**
 * Design with Claude. Claude does not draw pixels: it writes the short on-image copy and
 * picks a layout, as a small JSON spec. design-render draws it with brand colors and a
 * bundled font, so the text always renders and the result always fits the canvas.
 */

import { z } from "zod";
import { claudeComplete, CLAUDE_SONNET } from "@/lib/claude";
import type { DesignStyle } from "@/lib/social/design-config";

export const specSchema = z.object({
  headline: z.string().trim().min(1).max(70),
  subline: z.string().trim().max(110).optional(),
  button: z.string().trim().max(28).optional(),
  stat: z.object({ value: z.string().trim().min(1).max(10), label: z.string().trim().max(40) }).optional(),
});
export type DesignSpec = z.infer<typeof specSchema>;

/** Find the JSON object in a reply (it may be wrapped in prose or code fences) and validate it. */
export function parseSpec(reply: string, request: string): DesignSpec | null {
  const m = reply.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let raw: unknown;
  try { raw = JSON.parse(m[0]); } catch { return null; }
  const parsed = specSchema.safeParse(raw);
  if (!parsed.success) return null;
  const spec = parsed.data;
  // A number on the image must come from the request. Never let a made up figure through.
  if (spec.stat && !request.toLowerCase().includes(spec.stat.value.toLowerCase())) delete spec.stat;
  return spec;
}

const ANGLES = [
  "Lead with the clearest benefit in the headline.",
  "Lead with a question or a short, direct statement.",
  "Lead with the most specific fact from the request.",
];

export function buildSpecSystem(style: DesignStyle, variation: number): string {
  return [
    "You write the on-image text for one social media banner for a private capital platform. Another program draws it.",
    `Style is ${style}. ${ANGLES[variation % ANGLES.length]}`,
    "Reply with only JSON in this shape: {\"headline\": string (max 70 chars), \"subline\": string (max 110 chars, optional), \"button\": string (max 28 chars, optional), \"stat\": {\"value\": string (max 10 chars), \"label\": string (max 40 chars)} (optional)}.",
    "Use only facts, names and numbers that appear in the request. Never invent a number, statistic, name, claim or guarantee. Only include stat when the request gives that exact number.",
    "Plain direct wording. No emojis. Do not use dashes as punctuation.",
  ].join("\n");
}

/** Ask Claude for the copy for one option. Returns null when the reply cannot be used. */
export async function designCopy(request: string, style: DesignStyle, variation: number): Promise<DesignSpec | null> {
  const reply = await claudeComplete(
    [{ role: "user", content: `Banner request:\n\n${request}` }],
    { usage: { category: "internal", feature: "social_posts" }, model: CLAUDE_SONNET, system: buildSpecSystem(style, variation), maxTokens: 400, temperature: 0.8, locale: "en" },
  );
  return parseSpec(reply, request);
}
