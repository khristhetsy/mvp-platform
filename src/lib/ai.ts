import OpenAI from "openai";
import { requiredDocumentTypes } from "./mock-data";

type AnalysisInput = {
  companyName: string;
  documentSummaries: string[];
  uploadedDocumentTypes: string[];
};

export type GeneratedDiligenceReport = {
  executiveSummary: string;
  sections: Array<{ title: string; body: string }>;
  riskFlags: string[];
  missingDocuments: string[];
  recommendedNextSteps: string[];
  readinessScore: number | null;
  generatedBy: "unconfigured" | "openai";
  isDemo: boolean;
};

export async function generateDiligenceReport(input: AnalysisInput): Promise<GeneratedDiligenceReport> {
  const missingDocuments = requiredDocumentTypes.filter(
    (documentType) => !input.uploadedDocumentTypes.includes(documentType),
  );

  const documentNextSteps =
    missingDocuments.length > 0
      ? [`Upload missing documents: ${missingDocuments.join(", ")}`]
      : ["Upload required diligence documents for review."];

  if (!process.env.OPENAI_API_KEY) {
    return {
      executiveSummary:
        "AI diligence generation is not configured in this environment. This output is not a completed diligence report. Configure OPENAI_API_KEY or request staff-assisted review.",
      sections: [],
      riskFlags: [],
      missingDocuments,
      recommendedNextSteps: documentNextSteps,
      readinessScore: null,
      generatedBy: "unconfigured",
      isDemo: true,
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You produce conservative startup due diligence summaries. Do not provide investment advice or guarantee funding. Do not invent numeric readiness scores.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Create an investor diligence summary with risks, missing items, and next steps. Return plain text only.",
          companyName: input.companyName,
          documentSummaries: input.documentSummaries,
          missingDocuments,
        }),
      },
    ],
  });

  return {
    executiveSummary: response.output_text,
    sections: [],
    riskFlags: [],
    missingDocuments,
    recommendedNextSteps: documentNextSteps,
    readinessScore: null,
    generatedBy: "openai",
    isDemo: false,
  };
}
