import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "./claude";
import { missingRequiredDocumentLabels } from "./data/founder-readiness";

function titleCaseCode(code: string): string {
  return code.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

type AnalysisInput = {
  companyName: string;
  documentSummaries: string[];
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
        "Write each section body as 2–5 substantive sentences grounded in the documentSummaries, business context, and uploadedDocuments.",
        "If a section has no supporting evidence yet, set its body to exactly 'Not provided.'.",
        "executiveSummary: 2–4 sentences framing the company and the current state of diligence.",
        "riskFlags: concrete, specific diligence risks (each one sentence); use an empty array if none are supportable.",
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
