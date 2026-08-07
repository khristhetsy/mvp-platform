import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "./claude";
import { missingRequiredDocumentLabels } from "./data/founder-readiness";

function titleCaseCode(code: string): string {
  return code.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

type AnalysisInput = {
  companyName: string;
  documentSummaries: string[];
  /** Per-document summaries tagged with their document type, so each review
   *  section can be grounded in the right source (business plan, team bios…). */
  documentSummariesByType?: Array<{ type: string; summary: string }>;
  uploadedDocumentTypes: string[];
  /** Document types the founder marked "not applicable" (e.g. no customer
   *  contracts for this business) — excluded from the missing list. */
  notApplicableDocumentTypes?: string[];
  /** Company profile context for a richer, venture-memo-style analysis. */
  industry?: string | null;
  revenueStage?: string | null;
  fundingAmount?: number | null;
  businessDescription?: string | null;
  useOfFunds?: string | null;
};

/** The review sections every report carries, in order. */
const REVIEW_SECTIONS = ["Business overview", "Financial review", "Market review", "Legal & compliance review", "Team review"] as const;

function stripJsonFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export type GeneratedDiligenceReport = {
  executiveSummary: string;
  sections: Array<{ title: string; body: string }>;
  riskFlags: string[];
  missingDocuments: string[];
  recommendedNextSteps: string[];
  readinessScore: number | null;
  generatedBy: "unconfigured" | "claude";
  isDemo: boolean;
};

export async function generateDiligenceReport(input: AnalysisInput): Promise<GeneratedDiligenceReport> {
  // Normalize DB codes → required labels (with aliases) so uploaded documents are
  // actually credited instead of everything reading as missing. Types the founder
  // marked "not applicable" are excluded from the missing list too.
  const missingDocuments = missingRequiredDocumentLabels(input.uploadedDocumentTypes, undefined, input.notApplicableDocumentTypes ?? []);
  const uploadedLabels = [...new Set(input.uploadedDocumentTypes.map(titleCaseCode))];
  const notApplicableLabels = [...new Set((input.notApplicableDocumentTypes ?? []).map(titleCaseCode))];

  const documentNextSteps =
    missingDocuments.length > 0
      ? [`Upload missing documents: ${missingDocuments.join(", ")}`]
      : ["Upload required diligence documents for review."];

  // Financial review basis: a pre-revenue company is assessed on projections; a
  // revenue-generating company must supply actual financial statements.
  const rs = (input.revenueStage ?? "").toLowerCase();
  const isPreRevenue =
    !rs || rs.includes("pre") || rs.includes("idea") || rs.includes("mvp") || rs.includes("building") || rs.includes("prototype") || rs.includes("concept");
  const financialBasis = isPreRevenue ? "projections" : "actuals";

  if (!isClaudeConfigured()) {
    return {
      executiveSummary:
        "AI diligence generation is not configured. Add ANTHROPIC_API_KEY to your environment variables or request staff-assisted review.",
      sections: REVIEW_SECTIONS.map((title) => ({ title, body: "Not provided." })),
      riskFlags: [],
      missingDocuments,
      recommendedNextSteps: documentNextSteps,
      readinessScore: null,
      generatedBy: "unconfigured",
      isDemo: true,
    };
  }

  const raw = await claudeComplete(
    [
      {
        role: "user",
        content: JSON.stringify({
          companyName: input.companyName,
          industry: input.industry ?? null,
          stage: input.revenueStage ?? null,
          fundingTarget: input.fundingAmount ?? null,
          businessDescription: input.businessDescription ?? null,
          useOfFunds: input.useOfFunds ?? null,
          uploadedDocuments: uploadedLabels,
          notApplicableDocuments: notApplicableLabels,
          missingDocuments,
          documentSummaries: input.documentSummaries,
          documentsByType: input.documentSummariesByType ?? [],
          financialBasis,
          naNote:
            notApplicableLabels.length > 0
              ? "Documents in notApplicableDocuments were marked not applicable by the founder (this business genuinely has none — e.g. a SaaS or biotech with no customer contracts). Do NOT list them as missing or frame them as gaps or risks."
              : undefined,
          summaryNote:
            input.documentSummaries.length === 0 && uploadedLabels.length > 0
              ? "Documents in uploadedDocuments ARE on file but not yet content-analyzed. Base each section only on what you can support; where a section has no supporting content yet, return exactly 'Not provided.' — do NOT claim no documents exist."
              : undefined,
        }),
      },
    ],
    {
      model: CLAUDE_SONNET,
      maxTokens: 3000,
      system: [
        "You are an investment analyst producing a conservative, detailed venture diligence memo for a startup.",
        "Return ONLY a valid JSON object (no prose, no markdown fences) with these keys:",
        '{ "executiveSummary": string, "sections": [{ "title": string, "body": string }], "riskFlags": string[] }',
        "The sections array MUST contain exactly these titles, in this order, using these exact strings:",
        '"Business overview", "Financial review", "Market review", "Legal & compliance review", "Team review".',
        "Each entry in documentsByType has a `type` (the document) and its `summary`. Ground each section in its designated source document:",
        '"Business overview" and "Market review" come from the "Business Plan" document.',
        '"Team review" comes from the "Team Bios" document.',
        '"Legal & compliance review" comes from the "Legal Documents" and "Corporate Documents".',
        "Financial review depends on financialBasis:",
        'If financialBasis is "projections" (pre-revenue), base "Financial review" on the financial projections in the "Business Plan" (and "Financial Model" if present); assess the assumptions and their reasonableness, and do NOT treat the absence of historical statements as a gap.',
        'If financialBasis is "actuals" (revenue-generating), the company MUST provide a "Financial Statements" document; base "Financial review" on it. If no "Financial Statements" document is present, set "Financial review" to exactly "Actual financial statements are required for a revenue-generating company but were not provided." and add a matching risk flag.',
        "Write each section body as 2–5 substantive sentences grounded ONLY in that section's designated source document (plus business context).",
        "If a section's designated source document is absent or has no supporting content, set its body to exactly 'Not provided.' — do NOT fill it from other documents (Financial review follows its own rule above).",
        "executiveSummary: 2–4 sentences framing the company and the current state of diligence.",
        "riskFlags: concrete, specific diligence risks synthesized across ALL provided documents (each one sentence); use an empty array if none are supportable.",
        "Do NOT provide investment advice, recommend investing, or guarantee funding. Do NOT invent numbers, documents, or facts not present in the inputs.",
      ].join(" "),
    },
  );

  let parsed: { executiveSummary?: string; sections?: Array<{ title?: string; body?: string }>; riskFlags?: string[] } | null = null;
  try {
    parsed = JSON.parse(stripJsonFences(raw));
  } catch {
    parsed = null;
  }

  const bodyByTitle = new Map<string, string>();
  for (const s of parsed?.sections ?? []) {
    if (s?.title) bodyByTitle.set(s.title.trim().toLowerCase(), (s.body ?? "").trim());
  }
  const sections = REVIEW_SECTIONS.map((title) => {
    const body = bodyByTitle.get(title.toLowerCase());
    return { title, body: body && body.length > 0 ? body : "Not provided." };
  });

  const riskFlags = Array.isArray(parsed?.riskFlags)
    ? parsed!.riskFlags.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    : [];

  const executiveSummary =
    (parsed?.executiveSummary && parsed.executiveSummary.trim()) ||
    // Fallback: model didn't return JSON — keep the raw text as the summary.
    raw.trim();

  return {
    executiveSummary,
    sections,
    riskFlags,
    missingDocuments,
    recommendedNextSteps: documentNextSteps,
    readinessScore: null,
    generatedBy: "claude",
    isDemo: false,
  };
}
