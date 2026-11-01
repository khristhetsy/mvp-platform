/**
 * Asks the model to write the bridge and value lines from the training, and
 * keeps its answer only if `acceptGuidance` passes it. On any problem the fixed
 * text stays and the reason is reported, so a draft is always produced and the
 * person can see which kind of wording they are reading.
 */
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";
import { acceptGuidance, applyGuidance, buildGuidancePrompt, GUIDANCE_SYSTEM, parseGuidance, pickExamples } from "./guidance";
import type { DraftParts, Objection } from "./types";
import type { TrainingDocument, TrainingExample, WordingUsed } from "./training-types";

export type GuideInput = {
  parts: DraftParts;
  objection: Objection;
  technique: string;
  stageName: string | null;
  asked: string | null;
  concern: string | null;
  documents: TrainingDocument[];
  examples: TrainingExample[];
  blockedWords: string[];
};

export async function guideParts(input: GuideInput): Promise<{ parts: DraftParts; wording: WordingUsed }> {
  const trained = input.documents.filter((d) => d.status === "trained" && d.text);
  const picked = pickExamples(input.examples, input.stageName);
  const wording: WordingUsed = {
    documents: trained.map((d) => d.fileName),
    examplesSend: picked.send.length,
    examplesNever: picked.never.length,
    mode: "fixed",
    fallbackReason: null,
  };
  if (!trained.length && !picked.send.length && !picked.never.length) return { parts: input.parts, wording };
  if (!isClaudeConfigured()) return { parts: input.parts, wording: { ...wording, fallbackReason: "The AI reading is not configured" } };

  try {
    const raw = await claudeComplete(
      [{ role: "user", content: buildGuidancePrompt({ ...input, documents: trained }) }],
      { model: CLAUDE_HAIKU, system: GUIDANCE_SYSTEM, maxTokens: 400, temperature: 0.3, locale: "en", usage: { category: "internal", feature: "sales_ai_agent" } },
    );
    const accepted = acceptGuidance(parseGuidance(raw), input.blockedWords);
    if (!accepted.ok) return { parts: input.parts, wording: { ...wording, fallbackReason: accepted.reason } };
    return { parts: applyGuidance(input.parts, accepted.guidance), wording: { ...wording, mode: "guided" } };
  } catch {
    return { parts: input.parts, wording: { ...wording, fallbackReason: "The AI could not be reached" } };
  }
}
