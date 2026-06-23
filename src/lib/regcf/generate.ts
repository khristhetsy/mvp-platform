import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";
import { regCfDoc, type RegCfDocKey } from "@/lib/regcf/documents";

/** Loose company context — we read whatever the founder profile provides. */
export interface RegCfCompanyContext {
  company_name?: string | null;
  industry?: string | null;
  country?: string | null;
  state?: string | null;
  business_description?: string | null;
  [key: string]: unknown;
}

const DISCLAIMER =
  "DRAFT — for the founder's own use, not legal or investment advice. The founder owns and is responsible for this document. CapitalOS does not post, offer, solicit, host, or transact any securities.";

function contextBlock(c: RegCfCompanyContext): string {
  const lines: string[] = [];
  if (c.company_name) lines.push(`Company: ${c.company_name}`);
  if (c.industry) lines.push(`Industry: ${c.industry}`);
  if (c.state || c.country) lines.push(`Location: ${[c.state, c.country].filter(Boolean).join(", ")}`);
  if (c.business_description) lines.push(`Description: ${c.business_description}`);
  return lines.length ? lines.join("\n") : "(Limited company information provided — use [brackets] for missing facts.)";
}

/** Fallback used when no API key is configured — a structured placeholder draft. */
function fallbackDraft(docKey: RegCfDocKey, c: RegCfCompanyContext): string {
  const def = regCfDoc(docKey);
  return [
    `${def.label} — DRAFT`,
    "",
    `[AI drafting is not configured. This is a placeholder outline for ${c.company_name ?? "[Company]"}.]`,
    "",
    def.description,
    "",
    "Fill in the bracketed details from your company profile, or enable AI drafting to generate full content.",
    "",
    DISCLAIMER,
  ].join("\n");
}

/**
 * Draft a single Reg CF document from the company context. Uses Claude when
 * configured, otherwise returns a graceful placeholder. Output is always a
 * draft the founder owns and edits.
 */
export async function generateRegCfDocument(
  docKey: RegCfDocKey,
  company: RegCfCompanyContext,
): Promise<{ content: string; aiGenerated: boolean }> {
  const def = regCfDoc(docKey);

  if (!isClaudeConfigured()) {
    return { content: fallbackDraft(docKey, company), aiGenerated: false };
  }

  const system =
    "You are helping a startup founder draft DRAFT preparatory materials for a possible Regulation Crowdfunding (Reg CF) raise. " +
    "You produce working drafts the founder owns and will have reviewed by their own counsel. " +
    "You are not the issuer, broker, or intermediary; you do not offer, solicit, or sell securities. " +
    "Be factual and balanced; never invent specific financial figures — use [brackets] for anything not provided. " +
    "Do not add high-pressure marketing or projections. End every document with this exact line:\n" +
    DISCLAIMER;

  const user =
    `Draft the following document.\n\nDocument: ${def.label}\nInstruction: ${def.instruction}\n\n` +
    `Company context:\n${contextBlock(company)}`;

  try {
    const text = await claudeComplete([{ role: "user", content: user }], {
      model: CLAUDE_SONNET,
      maxTokens: 1800,
      temperature: 0.4,
      system,
    });
    const content = text && text.trim().length > 0 ? text.trim() : fallbackDraft(docKey, company);
    return { content, aiGenerated: text.trim().length > 0 };
  } catch {
    return { content: fallbackDraft(docKey, company), aiGenerated: false };
  }
}
