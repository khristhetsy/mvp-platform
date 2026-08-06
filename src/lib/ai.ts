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
};

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
      sections: [],
      riskFlags: [],
      missingDocuments,
      recommendedNextSteps: documentNextSteps,
      readinessScore: null,
      generatedBy: "unconfigured",
      isDemo: true,
    };
  }

  const text = await claudeComplete(
    [
      {
        role: "user",
        content: JSON.stringify({
          task: "Create an investor diligence summary with risks, missing items, and next steps. Return plain text only.",
          companyName: input.companyName,
          uploadedDocuments: uploadedLabels,
          notApplicableDocuments: notApplicableLabels,
          documentSummaries: input.documentSummaries,
          missingDocuments,
          naNote:
            notApplicableLabels.length > 0
              ? "Documents in notApplicableDocuments were marked not applicable by the founder (this business genuinely has none — e.g. a SaaS or biotech with no customer contracts). Do NOT list them as missing or frame them as gaps or risks."
              : undefined,
          note:
            input.documentSummaries.length === 0 && uploadedLabels.length > 0
              ? "Documents listed in uploadedDocuments ARE on file but not yet AI-summarized. Acknowledge they are present and pending content analysis — do NOT state that no documents exist."
              : undefined,
        }),
      },
    ],
    {
      model:     CLAUDE_SONNET,
      maxTokens: 1024,
      system:
        "You produce conservative startup due diligence summaries. Do not provide investment advice or guarantee funding. Do not invent numeric readiness scores.",
    }
  );

  return {
    executiveSummary: text,
    sections: [],
    riskFlags: [],
    missingDocuments,
    recommendedNextSteps: documentNextSteps,
    readinessScore: null,
    generatedBy: "claude",
    isDemo: false,
  };
}
