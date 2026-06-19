import { describe, it, expect } from "vitest";
import type { Company, DocumentRecord } from "@/lib/supabase/types";
import {
  buildDocumentChecklist,
  buildProfileCompletion,
  computeReadinessScore,
  documentTypeCode,
} from "@/lib/data/founder-readiness";

function doc(partial: Partial<DocumentRecord>): DocumentRecord {
  return {
    id: "doc",
    company_id: "co",
    document_type: null,
    file_name: null,
    status: null,
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  } as DocumentRecord;
}

describe("documentTypeCode", () => {
  it("uppercases and underscores labels to match stored codes", () => {
    expect(documentTypeCode("Pitch deck")).toBe("PITCH_DECK");
    expect(documentTypeCode("Financial statements")).toBe("FINANCIAL_STATEMENTS");
    expect(documentTypeCode("Cap table")).toBe("CAP_TABLE");
  });
});

describe("computeReadinessScore", () => {
  const required = ["Pitch deck", "Cap table", "Financial statements", "Business plan"];

  it("floors at 55 when nothing is uploaded (default 8 required docs)", () => {
    // 8 missing -> 90 - 48 = 42, floored to 55.
    expect(computeReadinessScore([])).toBe(55);
  });

  it("maxes at 90 when everything is uploaded", () => {
    expect(
      computeReadinessScore(
        ["PITCH_DECK", "CAP_TABLE", "FINANCIAL_STATEMENTS", "BUSINESS_PLAN"],
        required,
      ),
    ).toBe(90);
  });

  it("drops 6 points per missing required document", () => {
    // 1 of 4 missing -> 90 - 6 = 84
    expect(
      computeReadinessScore(["PITCH_DECK", "CAP_TABLE", "FINANCIAL_STATEMENTS"], required),
    ).toBe(84);
  });
});

describe("buildDocumentChecklist", () => {
  const required = ["Pitch deck", "Cap table", "Financial statements"];

  it("marks uploaded, needs-review, and missing documents correctly", () => {
    const checklist = buildDocumentChecklist(
      [
        doc({ document_type: "PITCH_DECK", status: "uploaded", file_name: "deck.pdf" }),
        doc({ document_type: "CAP_TABLE", status: "pending_review", file_name: "cap.xlsx" }),
        // Financial statements intentionally absent
      ],
      required,
    );

    const byLabel = Object.fromEntries(checklist.map((row) => [row.label, row]));
    expect(byLabel["Pitch deck"].status).toBe("uploaded");
    expect(byLabel["Pitch deck"].fileName).toBe("deck.pdf");
    expect(byLabel["Cap table"].status).toBe("needs_review");
    expect(byLabel["Financial statements"].status).toBe("missing");
    expect(byLabel["Financial statements"].fileName).toBeNull();
  });
});

describe("buildProfileCompletion", () => {
  it("returns 0% for a missing company", () => {
    expect(buildProfileCompletion(null).percent).toBe(0);
  });

  it("returns 100% when every tracked field is filled", () => {
    const company = {
      company_name: "Acme Robotics",
      industry: "Fintech",
      business_description: "We build autonomous capital infrastructure for SMBs.",
      funding_amount: 2_500_000,
      use_of_funds: "Engineering and go-to-market",
      revenue_stage: "Early revenue",
      team_summary: "Three technical co-founders",
    } as Company;

    expect(buildProfileCompletion(company).percent).toBe(100);
  });

  it("counts only completed fields and ignores too-short descriptions", () => {
    const company = {
      company_name: "Acme",
      industry: "Fintech",
      business_description: "too short",
      funding_amount: 0,
    } as Company;

    // company_name + industry complete (2 of 7) -> 29%
    expect(buildProfileCompletion(company).percent).toBe(29);
  });
});
