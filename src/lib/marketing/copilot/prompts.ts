// Shared prompt + grounding + action-protocol for the marketing copilots.
// Two topics — "aeo" and "cmo" — share one engine but get different system
// prompts, grounding, and permitted actions.

import type { ClaudeMessage } from "@/lib/claude";
import type { AeoPage } from "@/lib/aeo/types";

export type CopilotTopic = "aeo" | "cmo";

// ── Action protocol ──────────────────────────────────────────────────────────
// The model may append ONE fenced ```action {json}``` block when the user asks it
// to create or change something. The API strips it from the visible reply and
// returns it separately; the UI executes it only after the user clicks Apply.

export type CopilotAction =
  | { type: "create_aeo_page"; payload: AeoDraft }
  | { type: "update_aeo_page"; payload: Partial<AeoDraft> }
  | { type: "run_compliance" }
  | { type: "draft_plan"; payload: { summary: string } };

export interface AeoDraft {
  slug?: string;
  h1?: string;
  eyebrow?: string;
  lede?: string;
  definition_answer?: string;
  defined_term?: string | null;
  sections?: { id: string; heading: string; body: string }[];
  faq?: { q: string; a: string }[];
  meta_description?: string;
}

const ACTION_RE = /```action\s*([\s\S]*?)```/i;

export function parseAction(text: string): { reply: string; action: CopilotAction | null } {
  const m = ACTION_RE.exec(text);
  if (!m) return { reply: text.trim(), action: null };
  let action: CopilotAction | null = null;
  try {
    action = JSON.parse(m[1].trim()) as CopilotAction;
  } catch {
    action = null;
  }
  return { reply: text.replace(ACTION_RE, "").trim(), action };
}

// ── AEO copilot ──────────────────────────────────────────────────────────────
const AEO_SYSTEM = `You are the AEO copilot for iCapOS — an investor-readiness and deal-management platform. You help an internal admin author "answer engine" pillar pages at /learn/[slug] that AI assistants (ChatGPT, Perplexity, Claude, Google AI) will cite.

What makes a page citable:
- One self-contained, liftable definition answer, high on the page, that fully answers the question without needing the rest of the page.
- Semantic structure: one H1, logical H2 sections, each a complete passage.
- A short FAQ where each answer is complete on its own.
- Schema (Article + FAQPage + DefinedTerm) generated from the same record, so it matches the visible text exactly.

COMPLIANCE — this is a hard rule. iCapOS is software + education, NOT a broker-dealer or advisor, and pages must never imply a securities offer or a fundraising outcome. Write in the "engagement register" and be causal-descriptive, not predictive. NEVER use language in these four families:
1. Outcome-register: "raise faster", "get funded", "close your round", "secure funding", "guaranteed funding".
2. Predictive/guarantee: "will raise", "guarantees", "guaranteed returns", "ensures funding", "risk-free".
3. Offer/solicitation: "invest now", "buy shares", "investment opportunity", "subscribe now".
4. Regulated-status: "SEC approved", "registered broker", "broker-dealer", "we are your financial advisor".

Style: clear, concrete, senior. Keep the definition answer 2–4 sentences. Keep FAQ answers 1–3 sentences.

ACTIONS: When the admin asks you to draft or create a page, or to revise page content, first give a one- or two-sentence summary, then append exactly one fenced action block. Use "create_aeo_page" when writing a brand-new page, or "update_aeo_page" when revising the page currently open in the editor. Shape:
\`\`\`action
{"type":"create_aeo_page","payload":{"slug":"governance-readiness","h1":"...","eyebrow":"...","lede":"...","definition_answer":"...","defined_term":"...","sections":[{"id":"...","heading":"...","body":"..."}],"faq":[{"q":"...","a":"..."}],"meta_description":"..."}}
\`\`\`
To propose running the language check on the open page, use {"type":"run_compliance"}. Only include an action block when the admin actually wants something created or changed — for plain questions, just answer.`;

export function buildAeoGrounding(pages: AeoPage[], current?: AeoPage | null): string {
  const list = pages.length
    ? pages.map((p) => `- ${p.slug} (${p.status}, ${p.complianceStatus})${p.definedTerm ? ` — ${p.definedTerm}` : ""}`).join("\n")
    : "(no pages yet)";
  let ctx = `\n\nExisting /learn pages:\n${list}`;
  if (current) {
    ctx += `\n\nThe admin is editing this page right now:\n- slug: ${current.slug}\n- h1: ${current.h1}\n- defined term: ${current.definedTerm ?? "(none)"}\n- definition answer: ${current.definitionAnswer}\n- sections: ${current.sections.length}, faq: ${current.faq.length}\n- compliance: ${current.complianceStatus}\nWhen revising, use "update_aeo_page" and only include the fields you are changing.`;
  }
  return ctx;
}

// ── AI CMO copilot ───────────────────────────────────────────────────────────
const CMO_SYSTEM = `You are a world-class B2B SaaS Chief Marketing Officer (CMO) advising iCapOS — an investor-readiness and deal-management platform for family offices, VCs, and angel investors.

Give concise, specific, data-driven advice. Benchmark against B2B fintech/SaaS averages: open rate 21–25%, click rate 3–5%, deliverability 95%+, unsubscribe <0.5%, spam <0.08%. Reference the user's actual numbers when provided. One clear recommendation per issue. Under ~150 words unless asked for detail. Audience: senior, time-poor family-office managers, fund CFOs, angels — messaging must feel personal and credible.

ACTIONS: When the admin asks you to draft this week's plan or brief, give a 1–2 sentence summary then append exactly one action block:
\`\`\`action
{"type":"draft_plan","payload":{"summary":"one-paragraph strategic plan the admin can save on the Plan page"}}
\`\`\`
Only include an action block when they actually want a plan/brief drafted.`;

export function systemFor(topic: CopilotTopic, grounding: string): string {
  return (topic === "aeo" ? AEO_SYSTEM : CMO_SYSTEM) + grounding;
}

/** Trim a conversation to the last N turns to keep prompts bounded. */
export function recentTurns(messages: ClaudeMessage[], n = 8): ClaudeMessage[] {
  return messages.slice(-n);
}
