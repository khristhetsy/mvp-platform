import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "@/app/api/ai/reports/route";
import { readJsonResponse } from "@/test/mock-supabase";

vi.mock("@/lib/api/auth", () => ({
  requireApiProfile: vi.fn(),
}));

vi.mock("@/lib/ai", () => ({
  generateDiligenceReport: vi.fn(),
}));

vi.mock("@/lib/data/audit", () => ({
  writeAuditLog: vi.fn(),
}));

import { requireApiProfile } from "@/lib/api/auth";
import { generateDiligenceReport } from "@/lib/ai";
import { writeAuditLog } from "@/lib/data/audit";

const mockRequireApiProfile = vi.mocked(requireApiProfile);
const mockGenerateDiligenceReport = vi.mocked(generateDiligenceReport);
const mockWriteAuditLog = vi.mocked(writeAuditLog);

const companyId = "11111111-1111-4111-8111-111111111111";

function buildAuthSupabase(options: {
  company?: { data: unknown; error: unknown };
  documents?: { data: unknown; error?: unknown };
  insertReport?: { data: unknown; error: unknown };
}) {
  const from = vi.fn((table: string) => {
    if (table === "companies") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(options.company ?? { data: null, error: { message: "missing" } }),
          }),
        }),
      };
    }

    if (table === "documents") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(options.documents ?? { data: [], error: null }),
        }),
      };
    }

    if (table === "diligence_reports") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              options.insertReport ?? {
                data: { id: "report-1", company_id: companyId },
                error: null,
              },
            ),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { from };
}

describe("POST /api/ai/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  it("returns 401 when requireApiProfile rejects the session", async () => {
    mockRequireApiProfile.mockResolvedValue({
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    });

    const response = await POST(
      new Request("http://localhost/api/ai/reports", {
        method: "POST",
        body: JSON.stringify({ companyId }),
      }),
    );

    expect(response.status).toBe(401);
    const body = await readJsonResponse(response);
    expect(body.error).toBe("Authentication required.");
    expect(mockGenerateDiligenceReport).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid request body", async () => {
    mockRequireApiProfile.mockResolvedValue({
      supabase: buildAuthSupabase({}) as never,
      profile: { id: "admin-1", role: "admin" } as never,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/reports", {
        method: "POST",
        body: JSON.stringify({ companyId: "not-a-uuid" }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await readJsonResponse(response);
    expect(body.error).toBe("Invalid diligence report request.");
  });

  it("returns 404 when the company does not exist", async () => {
    mockRequireApiProfile.mockResolvedValue({
      supabase: buildAuthSupabase({
        company: { data: null, error: { message: "not found" } },
      }) as never,
      profile: { id: "admin-1", role: "admin" } as never,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/reports", {
        method: "POST",
        body: JSON.stringify({ companyId }),
      }),
    );

    expect(response.status).toBe(404);
    const body = await readJsonResponse(response);
    expect(body.error).toBe("Company not found.");
  });

  it("creates a diligence report for authorized staff", async () => {
    mockRequireApiProfile.mockResolvedValue({
      supabase: buildAuthSupabase({
        company: {
          data: { id: companyId, company_name: "Acme Corp" },
          error: null,
        },
        documents: {
          data: [{ document_type: "pitch_deck", ai_summary: "Strong traction" }],
        },
        insertReport: {
          data: { id: "report-1", company_id: companyId, executive_summary: "Summary" },
          error: null,
        },
      }) as never,
      profile: { id: "admin-1", role: "admin" } as never,
    });

    mockGenerateDiligenceReport.mockResolvedValue({
      executiveSummary: "Summary",
      sections: [{ title: "Business Overview", body: "Overview body" }],
      riskFlags: ["Limited financial history"],
      missingDocuments: ["cap_table"],
      recommendedNextSteps: ["Upload cap table"],
      readinessScore: null,
      generatedBy: "unconfigured",
      isDemo: true,
    });

    const response = await POST(
      new Request("http://localhost/api/ai/reports", {
        method: "POST",
        body: JSON.stringify({ companyId }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await readJsonResponse<{ report: { id: string }; generation: { generatedBy: string } }>(response);
    expect(body.report.id).toBe("report-1");
    expect(body.generation.generatedBy).toBe("unconfigured");
    expect(mockGenerateDiligenceReport).toHaveBeenCalledWith({
      companyName: "Acme Corp",
      documentSummaries: ["Strong traction"],
      uploadedDocumentTypes: ["pitch_deck"],
    });
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "admin-1",
        action: "diligence_report.created",
        entityType: "diligence_report",
      }),
    );
  });
});
