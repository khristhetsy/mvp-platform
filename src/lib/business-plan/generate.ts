// AI drafting for business-plan sections + the executive summary. Mirrors the
// Reg CF generator: guard with isClaudeConfigured(), fall back to a grounded
// template when unconfigured or on error. Never fabricates financial numbers or
// returns — projections are computed separately from the founder's assumptions.

import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";
import { getSectionDef } from "./sections";
import type { BusinessPlan } from "./types";

export interface PlanCompanyContext {
  name: string;
  industry: string | null;
  stage: string | null;
  description: string | null;
  fundingAmount: number | null;
}

const SYSTEM =
  "You help a founder draft their business plan. Write in plain, concrete, investor-ready language — short paragraphs, no buzzwords, no markdown headings. Ground everything in the facts provided; where a fact is missing, leave a clear [bracketed prompt] for the founder rather than inventing it. Never fabricate financial figures, valuations, or investor returns.";

function companyBlock(c: PlanCompanyContext): string {
  const raise = c.fundingAmount ? `$${c.fundingAmount.toLocaleString()}` : "[raise amount]";
  return `Company: ${c.name}\nIndustry: ${c.industry ?? "[industry]"}\nStage: ${c.stage ?? "[stage]"}\nRaising: ${raise}\nWhat they do: ${c.description ?? "[short description]"}`;
}

function fallbackDraft(sectionTitle: string, c: PlanCompanyContext): string {
  return `${c.name} — ${sectionTitle}.\n\n[Describe this section in 2–4 sentences. Lead with the most important point for an investor. Replace each bracket with your specifics.]\n\nContext: ${c.industry ?? "[industry]"} · ${c.stage ?? "[stage]"}.`;
}

export async function generateSectionDraft(
  sectionId: string,
  company: PlanCompanyContext,
  existing: BusinessPlan["sections"] | null,
): Promise<{ content: string; aiGenerated: boolean }> {
  const def = getSectionDef(sectionId);
  if (!def || sectionId === "projections") {
    return { content: "", aiGenerated: false };
  }
  if (!isClaudeConfigured()) {
    return { content: fallbackDraft(def.title, company), aiGenerated: false };
  }

  const problem = existing?.problem?.content ? `\nThe founder's stated problem: ${existing.problem.content}` : "";
  const solution = existing?.solution?.content ? `\nThe founder's stated solution: ${existing.solution.content}` : "";
  const user = `${companyBlock(company)}${problem}${solution}\n\nDraft the "${def.title}" section. ${def.prompt}\nKeep it to 2–4 short sentences.`;

  try {
    const content = await claudeComplete([{ role: "user", content: user }], {
      model: CLAUDE_SONNET,
      maxTokens: 600,
      temperature: 0.5,
      system: SYSTEM,
    });
    return { content: content.trim(), aiGenerated: true };
  } catch {
    return { content: fallbackDraft(def.title, company), aiGenerated: false };
  }
}

export async function generateExecSummary(
  company: PlanCompanyContext,
  sections: BusinessPlan["sections"],
): Promise<{ content: string; aiGenerated: boolean }> {
  const parts = ["problem", "solution", "market", "business_model", "traction", "use_of_funds"]
    .map((id) => sections[id]?.content?.trim())
    .filter(Boolean)
    .join("\n");

  if (!isClaudeConfigured()) {
    const fb = `${company.name} is a ${company.industry ?? "[industry]"} company. [One-sentence problem.] [One-sentence solution.] [Market + model.] Raising ${company.fundingAmount ? `$${company.fundingAmount.toLocaleString()}` : "[amount]"} to [goal].`;
    return { content: fb, aiGenerated: false };
  }

  const user = `${companyBlock(company)}\n\nThe founder's plan so far:\n${parts || "[limited content]"}\n\nWrite a 3–4 sentence executive summary an investor can read in 30 seconds: what the company does, the market, the model, and the raise. No fabricated numbers.`;
  try {
    const content = await claudeComplete([{ role: "user", content: user }], {
      model: CLAUDE_SONNET,
      maxTokens: 400,
      temperature: 0.4,
      system: SYSTEM,
    });
    return { content: content.trim(), aiGenerated: true };
  } catch {
    return { content: `${company.name} — [executive summary pending].`, aiGenerated: false };
  }
}
