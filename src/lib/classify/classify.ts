// Prospect Pipeline — Step 2: side classifier. Deterministic heuristics first
// (free, instant), AI fallback only for the ambiguous middle. Degrades safely:
// with no AI key, ambiguous rows stay unclassified and surface in the review
// queue rather than being guessed.

import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";

export type Side = "founder" | "investor";

export interface ClassifyInput {
  name?: string | null;
  email?: string | null;
  company?: string | null;
  company_domain?: string | null;
  signals?: Record<string, unknown> | null;
}

export interface ClassifyResult {
  side: Side | null;   // null = ambiguous → manual review
  confidence: number;  // 0..100
  reason: string;
  method: "heuristic" | "ai" | "none";
}

const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com", "live.com", "msn.com"]);

// Strong investor signals in a domain or company name.
const INVESTOR_KW = ["capital", "ventures", "venture", "partners", " fund", "fund ", "vc", "equity", "holdings", "asset management", "angel", "invest", "advisors", "wealth"];
// Startup / builder signals → founder.
const FOUNDER_KW = ["labs", "technologies", "startup", "studio", "ai", ".io", "app", "software", "saas", "health", "bio", "robotics"];

function hasKw(haystack: string, kws: string[]): string | null {
  const h = ` ${haystack.toLowerCase()} `;
  for (const kw of kws) if (h.includes(kw)) return kw.trim();
  return null;
}

/** Deterministic first pass. Returns null side when inconclusive. */
export function classifyHeuristic(input: ClassifyInput): ClassifyResult {
  const domain = (input.company_domain ?? "").toLowerCase();
  const company = (input.company ?? "").toLowerCase();
  const emailDomain = (input.email ?? "").split("@")[1]?.toLowerCase() ?? "";
  const raising = Boolean((input.signals ?? {})?.["raising"]);
  const hay = `${company} ${domain}`;

  const inv = hasKw(hay, INVESTOR_KW);
  if (inv) return { side: "investor", confidence: 80, reason: `Investor signal: “${inv}” in company/domain`, method: "heuristic" };

  if (raising) return { side: "founder", confidence: 78, reason: "Signal: actively raising", method: "heuristic" };

  const fnd = hasKw(hay, FOUNDER_KW);
  if (fnd && domain && !FREE_MAIL.has(emailDomain)) {
    return { side: "founder", confidence: 70, reason: `Startup signal: “${fnd}” + own domain`, method: "heuristic" };
  }

  // Own company domain (not free mail) with a company name → likely a builder/founder.
  if (domain && !FREE_MAIL.has(emailDomain) && company) {
    return { side: "founder", confidence: 62, reason: "Has own company domain", method: "heuristic" };
  }

  return { side: null, confidence: 0, reason: "No strong signal", method: "none" };
}

/** AI fallback for ambiguous rows. Returns null on any failure (→ review queue). */
export async function classifyAi(input: ClassifyInput): Promise<ClassifyResult | null> {
  if (!isClaudeConfigured()) return null;
  const facts = [
    input.name ? `Name: ${input.name}` : null,
    input.company ? `Company: ${input.company}` : null,
    input.company_domain ? `Domain: ${input.company_domain}` : null,
    input.email ? `Email domain: ${(input.email.split("@")[1] ?? "")}` : null,
  ].filter(Boolean).join("\n");

  const system = [
    "You classify a business contact as a 'founder' (operates or builds a startup/company seeking capital) or an 'investor' (deploys capital: VC, angel, fund, family office).",
    "Return ONLY compact JSON: {\"side\":\"founder\"|\"investor\"|\"unknown\",\"confidence\":0-100,\"reason\":\"short\"}.",
    "Use 'unknown' when genuinely ambiguous — do not guess. Never use the terms 'SPV' or 'broker-dealer'.",
  ].join(" ");

  try {
    const text = await claudeComplete([{ role: "user", content: facts }], { model: CLAUDE_HAIKU, maxTokens: 120, temperature: 0, system, locale: "en" });
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { side?: string; confidence?: number; reason?: string };
    const side = json.side === "founder" || json.side === "investor" ? json.side : null;
    const confidence = Math.max(0, Math.min(100, Math.round(Number(json.confidence ?? 0))));
    return { side, confidence: side ? confidence : 0, reason: String(json.reason ?? "AI classification"), method: "ai" };
  } catch {
    return null;
  }
}

/** Full classify: heuristic, then AI only if inconclusive. */
export async function classifyContact(input: ClassifyInput): Promise<ClassifyResult> {
  const h = classifyHeuristic(input);
  if (h.side && h.confidence >= 60) return h;
  const ai = await classifyAi(input);
  if (ai && ai.side && ai.confidence >= 60) return ai;
  // Keep the best suggestion (if any) for the review queue, but leave side null.
  const best = ai ?? h;
  return { side: null, confidence: best.confidence, reason: best.reason, method: best.method };
}
