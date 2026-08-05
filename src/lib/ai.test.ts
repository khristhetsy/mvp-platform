import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDiligenceReport } from "@/lib/ai";
import { requiredDocumentTypes } from "@/lib/documents/required-types";

// Mock the claude helper so tests don't make real API calls
vi.mock("@/lib/claude", () => ({
  claudeComplete: vi.fn().mockResolvedValue("Strong market positioning with moderate execution risk."),
  isClaudeConfigured: vi.fn(() => Boolean(process.env.ANTHROPIC_API_KEY?.trim())),
  CLAUDE_HAIKU: "claude-haiku-4-5-20251001",
  CLAUDE_SONNET: "claude-sonnet-4-6",
}));

describe("generateDiligenceReport", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("returns an unconfigured demo report when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

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

  it("returns a Claude-generated summary when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    // Real uploads are DB codes (PITCH_DECK), not labels — and FINANCIAL_STATEMENTS
    // is an alias for the "Financial model" requirement.
    const report = await generateDiligenceReport({
      companyName: "Acme Corp",
      documentSummaries: ["Pitch deck summary"],
      uploadedDocumentTypes: ["PITCH_DECK", "FINANCIAL_STATEMENTS"],
    });

    expect(report.generatedBy).toBe("claude");
    expect(report.isDemo).toBe(false);
    expect(report.executiveSummary).toContain("Strong market positioning");
    // Pitch deck + Financial model (via alias) are covered → 2 fewer missing.
    expect(report.missingDocuments).not.toContain("Pitch deck");
    expect(report.missingDocuments).not.toContain("Financial model");
    expect(report.missingDocuments.length).toBe(requiredDocumentTypes.length - 2);
  });
});
