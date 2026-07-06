// AI drafting for a single pitch-deck slide. Mirrors business-plan/generate.ts:
// guard with isClaudeConfigured(), grounded fallback, never fabricate numbers.
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";
import { getDeckSlideDef } from "./slides";
import type { DeckCompanyContext } from "./prefill";
import type { BusinessPlan } from "@/lib/business-plan/types";

const SYSTEM =
  "You write concise investor pitch-deck slides. Output a single headline line, then 2–4 short bullet points starting with '• '. Plain, punchy, concrete — no buzzwords, no markdown headings. Ground everything in the facts provided; where a fact is missing leave a clear [bracketed prompt] rather than inventing it. Never fabricate financial figures, valuations, or investor returns.";

function companyBlock(c: DeckCompanyContext): string {
  const raise = c.fundingAmount ? `$${c.fundingAmount.toLocaleString()}` : "[raise amount]";
  return `Company: ${c.name}\nIndustry: ${c.industry ?? "[industry]"}\nStage: ${c.stage ?? "[stage]"}\nRaising: ${raise}\nWhat they do: ${c.description ?? "[short description]"}`;
}

function parse(text: string): { headline: string; body: string } {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const headline = (lines[0] ?? "").replace(/^#+\s*/, "").replace(/^[•\-*]\s*/, "");
  const body = lines.slice(1).map((l) => (l.startsWith("•") ? l : `• ${l.replace(/^[•\-*]\s*/, "")}`)).join("\n");
  return { headline, body: body || "• [Add your points]" };
}

export async function generateSlideDraft(
  slideId: string,
  company: DeckCompanyContext,
  plan: BusinessPlan | null,
): Promise<{ headline: string; body: string; aiGenerated: boolean }> {
  const def = getDeckSlideDef(slideId);
  if (!def) return { headline: "", body: "", aiGenerated: false };

  const source = def.fromSection ? plan?.sections?.[def.fromSection]?.content?.trim() : "";
  if (!isClaudeConfigured()) {
    return { headline: def.title, body: source ? source.split(/(?<=[.!?])\s+/).slice(0, 3).map((s) => `• ${s.trim()}`).join("\n") : "• [Add your points]", aiGenerated: false };
  }
  const ctx = source ? `\nRelevant business-plan content: ${source}` : "";
  const user = `${companyBlock(company)}${ctx}\n\nDraft the "${def.title}" slide. ${def.prompt}`;
  try {
    const content = await claudeComplete([{ role: "user", content: user }], { model: CLAUDE_SONNET, maxTokens: 400, temperature: 0.5, system: SYSTEM });
    return { ...parse(content), aiGenerated: true };
  } catch {
    return { headline: def.title, body: "• [Add your points]", aiGenerated: false };
  }
}
