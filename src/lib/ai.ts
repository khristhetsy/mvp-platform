import OpenAI from "openai";
import { requiredDocumentTypes, sampleReport } from "./mock-data";

type AnalysisInput = {
  companyName: string;
  documentSummaries: string[];
  uploadedDocumentTypes: string[];
};

export async function generateDiligenceReport(input: AnalysisInput) {
  const missingDocuments = requiredDocumentTypes.filter(
    (documentType) => !input.uploadedDocumentTypes.includes(documentType),
  );

  if (!process.env.OPENAI_API_KEY) {
    return {
      ...sampleReport,
      missingDocuments,
      readinessScore: Math.max(55, 90 - missingDocuments.length * 6),
      generatedBy: "mock-ai",
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You produce conservative startup due diligence summaries. Do not provide investment advice or guarantee funding.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Create an investor diligence report with risks, missing items, score, and next steps.",
          companyName: input.companyName,
          documentSummaries: input.documentSummaries,
          missingDocuments,
        }),
      },
    ],
  });

  return {
    executiveSummary: response.output_text,
    sections: sampleReport.sections,
    riskFlags: sampleReport.riskFlags,
    missingDocuments,
    recommendedNextSteps: sampleReport.recommendedNextSteps,
    readinessScore: Math.max(55, 90 - missingDocuments.length * 6),
    generatedBy: "openai",
  };
}
