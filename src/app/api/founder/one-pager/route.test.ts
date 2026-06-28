import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJsonResponse } from "@/test/mock-supabase";

vi.mock("@/lib/api/auth", () => ({ requireApiProfile: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/data/documents", () => ({ listCompanyDocuments: vi.fn() }));
vi.mock("@/lib/data/marketplace", () => ({ ensureCompanySlug: vi.fn() }));
vi.mock("@/lib/analytics/posthog", () => ({ track: vi.fn() }));

import { POST } from "@/app/api/founder/one-pager/route";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listCompanyDocuments } from "@/lib/data/documents";
import { ensureCompanySlug } from "@/lib/data/marketplace";

const mockAuth = vi.mocked(requireApiProfile);
const mockAdmin = vi.mocked(createServiceRoleClient);
const mockListDocs = vi.mocked(listCompanyDocuments);
const mockSlug = vi.mocked(ensureCompanySlug);

const founderId = "f1111111-1111-4111-8111-111111111111";
const companyId = "c1111111-1111-4111-8111-111111111111";

function req(action: string) {
  return new Request("http://localhost/api/founder/one-pager", {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

/** Fake service-role client: companies read returns the company; update is captured. */
function fakeAdmin(updateSpy: ReturnType<typeof vi.fn>) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: companyId, company_name: "Acme", slug: "acme", is_published: false, published_at: null },
            error: null,
          }),
        }),
      }),
      update: vi.fn((patch: unknown) => ({
        eq: vi.fn(() => {
          updateSpy(patch);
          return Promise.resolve({ error: null });
        }),
      })),
    })),
  };
}

const CORE_DOCS = [
  { document_type: "PITCH_DECK" },
  { document_type: "FINANCIAL_STATEMENTS" },
  { document_type: "CAP_TABLE" },
];

describe("POST /api/founder/one-pager — publish force gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAuth.mockResolvedValue({ profile: { id: founderId }, supabase: {} } as any);
    mockSlug.mockResolvedValue("acme");
  });

  it("BLOCKS publish with a 403 when the core diligence docs are missing", async () => {
    const updateSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.mockReturnValue(fakeAdmin(updateSpy) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockListDocs.mockResolvedValue({ data: [], error: null } as any);

    const res = await POST(req("publish"));
    expect(res.status).toBe(403);
    const body = await readJsonResponse(res);
    expect(body.error).toMatch(/data room essentials/i);
    expect(Array.isArray(body.missing)).toBe(true);
    // critically: it never flips is_published
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("ALLOWS publish once all core docs are uploaded", async () => {
    const updateSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.mockReturnValue(fakeAdmin(updateSpy) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockListDocs.mockResolvedValue({ data: CORE_DOCS, error: null } as any);

    const res = await POST(req("publish"));
    expect(res.status).toBe(200);
    const body = await readJsonResponse(res);
    expect(body.is_published).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ is_published: true }));
  });

  it("does not gate unpublish (no document requirement to take a listing down)", async () => {
    const updateSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAdmin.mockReturnValue(fakeAdmin(updateSpy) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockListDocs.mockResolvedValue({ data: [], error: null } as any);

    const res = await POST(req("unpublish"));
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ is_published: false }));
  });
});
