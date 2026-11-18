import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/onboarding/ensure-founder-setup", () => ({ ensureUserOnboarding: vi.fn() }));

import { demoFounderEmail, demoPlanForTier, provisionDemoFounder } from "./provision-demo-founder";

describe("demo founder helpers", () => {
  it("uses an address on a reserved TLD that cannot receive mail", () => {
    expect(demoFounderEmail("abc")).toBe("demo-abc@demo.icapos.invalid");
  });

  it("maps the org tier to a founder plan, Professional by default", () => {
    expect(demoPlanForTier("basic")).toBe("founder_basic");
    expect(demoPlanForTier("professional")).toBe("founder_professional");
    expect(demoPlanForTier(null)).toBe("founder_professional");
  });
});

describe("provisionDemoFounder", () => {
  it("refuses a Deal Company", async () => {
    await expect(provisionDemoFounder({} as SupabaseClient, { id: "o", name: "N", tier: null, type: "spv" })).rejects.toThrow(
      "Only Founder accounts",
    );
  });

  it("does not create a second founder when the org already has a company", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn();
    const admin = {
      auth: { admin: { createUser } },
      from: (table: string) =>
        table === "companies"
          ? {
              select: () => ({
                eq: () => ({
                  order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: "c1", founder_id: "f1" } }) }) }),
                }),
              }),
            }
          : { upsert },
    } as unknown as SupabaseClient;

    const result = await provisionDemoFounder(admin, { id: "o1", name: "Demo", tier: "professional", type: "founder" });

    expect(result).toEqual({ founderId: "f1", companyId: "c1", created: false });
    expect(createUser).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith({ user_id: "f1", org_id: "o1", role: "owner" }, { onConflict: "user_id,org_id" });
  });
});
