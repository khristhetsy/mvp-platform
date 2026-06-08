import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "@/app/api/admin/companies/[id]/approve/route";
import { readJsonResponse } from "@/test/mock-supabase";

vi.mock("@/lib/api/admin", () => ({
  requireStaffApi: vi.fn(),
  STAFF_ROLES: ["admin", "analyst"],
  normalizeUserRole: vi.fn((role: string) => role?.toLowerCase()),
}));

vi.mock("@/lib/data/admin-reviews", () => ({
  applyCompanyReview: vi.fn(),
}));

vi.mock("@/lib/data/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/debug/admin-debug", () => ({
  adminDebug: vi.fn(),
}));

import { requireStaffApi } from "@/lib/api/admin";
import { applyCompanyReview } from "@/lib/data/admin-reviews";
import { writeAuditLog } from "@/lib/data/audit";

const mockRequireStaffApi = vi.mocked(requireStaffApi);
const mockApplyCompanyReview = vi.mocked(applyCompanyReview);
const mockWriteAuditLog = vi.mocked(writeAuditLog);

const companyId = "22222222-2222-4222-8222-222222222222";

describe("POST /api/admin/companies/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteAuditLog.mockResolvedValue(undefined);
  });

  it("returns 403 when the caller is not staff", async () => {
    mockRequireStaffApi.mockResolvedValue({
      error: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 }),
    });

    const response = await POST(new Request(`http://localhost/api/admin/companies/${companyId}/approve`, { method: "POST" }), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(403);
    const body = await readJsonResponse(response);
    expect(body.error).toBe("Insufficient permissions.");
    expect(mockApplyCompanyReview).not.toHaveBeenCalled();
  });

  it("returns 400 when applyCompanyReview fails", async () => {
    mockRequireStaffApi.mockResolvedValue({
      profile: { id: "admin-1", role: "admin" } as never,
      supabase: { from: vi.fn() } as never,
      userSupabase: { from: vi.fn() } as never,
    });
    mockApplyCompanyReview.mockResolvedValue({
      error: { message: "Company not found." },
    });

    const response = await POST(new Request(`http://localhost/api/admin/companies/${companyId}/approve`, { method: "POST" }), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(400);
    const body = await readJsonResponse(response);
    expect(body.error).toBe("Company not found.");
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("approves a company and writes an audit log", async () => {
    mockRequireStaffApi.mockResolvedValue({
      profile: { id: "admin-1", role: "admin" } as never,
      supabase: { from: vi.fn() } as never,
      userSupabase: { from: vi.fn() } as never,
    });
    mockApplyCompanyReview.mockResolvedValue({
      data: {
        company: { id: companyId, slug: "acme-corp", review_status: "approved" },
        review: { id: "review-1" },
      },
      error: null,
    });

    const response = await POST(new Request(`http://localhost/api/admin/companies/${companyId}/approve`, { method: "POST" }), {
      params: Promise.resolve({ id: companyId }),
    });

    expect(response.status).toBe(200);
    const body = await readJsonResponse<{ company: { id: string; slug: string } }>(response);
    expect(body.company.id).toBe(companyId);
    expect(body.company.slug).toBe("acme-corp");
    expect(mockApplyCompanyReview).toHaveBeenCalledWith(expect.anything(), {
      companyId,
      adminId: "admin-1",
      action: "approve",
    });
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "admin-1",
        action: "company.approved",
        entityType: "company",
        entityId: companyId,
      }),
    );
  });
});
