import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJsonResponse } from "@/test/mock-supabase";

vi.mock("@/lib/api/auth", () => ({ requireApiProfile: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/organizations/organizations", () => ({ getOrganization: vi.fn() }));
vi.mock("@/lib/lemonsqueezy", () => ({ createCheckoutUrl: vi.fn() }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: vi.fn() }));

import { POST } from "./route";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getOrganization } from "@/lib/organizations/organizations";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { sendEmail } from "@/lib/email/send-email";

const mockAuth = vi.mocked(requireApiProfile);
const mockAdmin = vi.mocked(createServiceRoleClient);
const mockOrg = vi.mocked(getOrganization);
const mockCheckout = vi.mocked(createCheckoutUrl);
const mockSend = vi.mocked(sendEmail);

const demoOrg = { id: "o1", name: "Christopher Williams", type: "founder", created_via: "admin_direct", purpose: "demo", tier: "professional" };

function adminClient(opts: { founderId?: string | null; saved?: Record<string, string | null> | null; savedError?: boolean }) {
  const updates: Array<{ table: string; payload: unknown }> = [];
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c;
    c.maybeSingle = async () => result;
    return c;
  };
  return {
    updates,
    client: {
      from: (table: string) => ({
        select: () =>
          table === "companies"
            ? chain({ data: opts.founderId === null ? null : { id: "c1", founder_id: opts.founderId ?? "f1" } })
            : chain(opts.savedError ? { data: null, error: { message: "no column" } } : { data: opts.saved ?? null, error: null }),
        update: (payload: unknown) => {
          updates.push({ table, payload });
          const u: Record<string, unknown> = { eq: async () => ({ error: null }) };
          return u;
        },
      }),
    },
  };
}

function request(body: unknown) {
  return new Request("http://test/api/admin/accounts/o1/convert", { method: "POST", body: JSON.stringify(body) });
}
const params = { params: Promise.resolve({ id: "o1" }) };

// The route's inferred return type includes undefined through requireApiProfile's union.
async function call(body: unknown): Promise<Response> {
  return (await POST(request(body), params)) as Response;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL", "222");
  mockAuth.mockResolvedValue({ profile: { id: "staff", role: "admin" } } as never);
  mockOrg.mockResolvedValue(demoOrg as never);
  mockCheckout.mockResolvedValue("https://pay.example/checkout");
  mockSend.mockResolvedValue(true);
});

describe("POST /api/admin/accounts/[id]/convert", () => {
  it("only converts an admin-created Founder demo", async () => {
    mockAdmin.mockReturnValue(adminClient({}).client as never);
    mockOrg.mockResolvedValue({ ...demoOrg, purpose: "internal" } as never);
    const res = await call({ plan: "founder_professional", billToEmail: "c@x.com" });
    expect(res.status).toBe(400);
  });

  it("asks for Set up founder when the account has no founder", async () => {
    mockAdmin.mockReturnValue(adminClient({ founderId: null }).client as never);
    const res = await call({ plan: "founder_professional", billToEmail: "c@x.com" });
    const body = await readJsonResponse<{ error: string }>(res);
    expect(res.status).toBe(400);
    expect(body.error).toContain("Set up founder");
  });

  it("rejects a missing or invalid bill to email", async () => {
    mockAdmin.mockReturnValue(adminClient({}).client as never);
    const res = await call({ plan: "founder_professional", billToEmail: "not-an-email" });
    expect(res.status).toBe(400);
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it("makes the checkout link for the demo founder with the client's email and emails it", async () => {
    const { client, updates } = adminClient({});
    mockAdmin.mockReturnValue(client as never);
    const res = await call({ plan: "founder_professional", billToName: "Chris W", billToEmail: "c@x.com" });
    const body = await readJsonResponse<{ url: string; emailed: boolean }>(res);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ url: "https://pay.example/checkout", emailed: true });
    expect(mockCheckout).toHaveBeenCalledWith(expect.objectContaining({ variantId: "222", email: "c@x.com", profileId: "f1", name: "Chris W" }));
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: "c@x.com" }));
    expect(updates[0]).toMatchObject({ table: "organizations", payload: expect.objectContaining({ conversion_plan: "founder_professional", conversion_email: "c@x.com" }) });
  });

  it("returns the link without emailing when send is false (Copy link), reusing the saved details", async () => {
    mockAdmin.mockReturnValue(adminClient({ saved: { conversion_plan: "founder_professional", conversion_name: "Chris W", conversion_email: "c@x.com" } }).client as never);
    const res = await call({ send: false });
    expect(res.status).toBe(200);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockCheckout).toHaveBeenCalledWith(expect.objectContaining({ email: "c@x.com" }));
  });

  it("says the migration is missing instead of failing silently", async () => {
    mockAdmin.mockReturnValue(adminClient({ savedError: true }).client as never);
    const res = await call({ plan: "founder_professional", billToEmail: "c@x.com" });
    expect(res.status).toBe(503);
  });
});
