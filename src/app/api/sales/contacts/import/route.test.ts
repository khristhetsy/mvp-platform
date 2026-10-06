import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "@/lib/verify/fake-db.test-helper";

let db: FakeDb;
vi.mock("@/lib/supabase/auth", () => ({ requireRole: vi.fn(async () => ({ id: "u1", role: "admin" })) }));
vi.mock("@/lib/supabase/admin", () => ({ serviceRoleClientUntyped: () => db }));
vi.mock("@/lib/sales/scope", () => ({ getSalesScope: vi.fn(async () => ({ isManager: true })) }));
vi.mock("@/lib/contacts/field-mapping-store", () => ({ ensureCustomFields: vi.fn(), loadCustomFields: vi.fn(async () => []), saveMappings: vi.fn() }));

import { POST } from "./route";
import type { NextRequest } from "next/server";

const req = (body: unknown) => POST(new Request("https://x/api/sales/contacts/import", { method: "POST", body: JSON.stringify(body) }) as unknown as NextRequest);
const rows = [{ name: "Jane Doe", email: "jane@acme.com" }, { name: "Bob Ray", email: "bob@acme.com" }];

beforeEach(() => { db = new FakeDb(); });

describe("sales contacts import provenance", () => {
  it("preview works without provenance", async () => {
    const res = await req({ mode: "preview", rows });
    expect(res.status).toBe(200);
    expect((await res.json()).toCreate).toBe(2);
  });

  it("refuses a commit without a source note or lawful basis", async () => {
    expect((await req({ mode: "commit", rows })).status).toBe(400);
    expect((await req({ mode: "commit", rows, sourceNote: "ab", lawfulBasis: "consent" })).status).toBe(400);
    expect((await req({ mode: "commit", rows, sourceNote: "Expo list", lawfulBasis: "nope" })).status).toBe(400);
    expect(db.rows("crm_contacts")).toHaveLength(0);
  });

  it("stores the source note and lawful basis on every new contact", async () => {
    const res = await req({ mode: "commit", rows, sourceNote: "  Newport Beach expo, Sept 2026 ", lawfulBasis: "existing_relationship" });
    expect(res.status).toBe(200);
    expect(db.rows("crm_contacts")).toHaveLength(2);
    for (const c of db.rows("crm_contacts")) {
      expect(c).toMatchObject({ data_source_note: "Newport Beach expo, Sept 2026", lawful_basis: "existing_relationship", source: "manual" });
    }
  });
});
