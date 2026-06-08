import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDiligenceReport } from "@/lib/ai";
import { requiredDocumentTypes } from "@/lib/mock-data";

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = {
      create: vi.fn().mockResolvedValue({
        output_text: "Strong market positioning with moderate execution risk.",
      }),
    };
  },
}));

describe("generateDiligenceReport", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  it("returns an unconfigured demo report when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const report = await generateDiligenceReport({
      companyName: "Acme Corp",
      documentSummaries: [],
      uploadedDocumentTypes: [],
    });

    expect(report.generatedBy).toBe("unconfigured");
    expect(report.isDemo).toBe(true);
    expect(report.readinessScore).toBeNull();
    expect(report.missingDocuments).toEqual([...requiredDocumentTypes]);
    expect(report.executiveSummary).toContain("not configured");
  });

  it("returns an OpenAI-generated summary when OPENAI_API_KEY is set", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const report = await generateDiligenceReport({
      companyName: "Acme Corp",
      documentSummaries: ["Pitch deck summary"],
      uploadedDocumentTypes: [requiredDocumentTypes[0] ?? "pitch_deck"],
    });

    expect(report.generatedBy).toBe("openai");
    expect(report.isDemo).toBe(false);
    expect(report.executiveSummary).toContain("Strong market positioning");
    expect(report.missingDocuments.length).toBe(requiredDocumentTypes.length - 1);
  });
});
