import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sales/contacts", () => ({
  getContactProfile: async (id: string) => ({ contact: { id, name: "John Boesel", email: "john@example.com", company: "Source Vision Corp", tags: ["SPV"], street: null, street2: null, city: null, state: null, zip: null } }),
}));

import { createPackageDocuments, PackageMastersMissing } from "./create";
import { SUBSCRIPTION_TEMPLATE_KEYS } from "./package";

// A tiny in memory stand in for the Supabase client: just the calls create.ts and store.ts make.
type Row = Record<string, unknown>;
function fakeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const files: Record<string, number> = {};
  let n = 0;
  const from = (table: string) => {
    const q = { filters: [] as ((r: Row) => boolean)[], insert: null as Row | null, one: false };
    const rows = () => (tables[table] ??= []);
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            return (res: (v: unknown) => void) => {
              if (q.insert) {
                const row = { id: `id-${++n}`, locked: false, archived_at: null, source: "template", ...q.insert }; // column defaults of the real table
                rows().push(row);
                return res({ data: q.one ? row : [row], error: null });
              }
              const out = rows().filter((r) => q.filters.every((f) => f(r)));
              return res({ data: q.one ? out[0] ?? null : out, error: null });
            };
          }
          return (...a: unknown[]) => {
            if (prop === "eq") q.filters.push((r) => r[a[0] as string] === a[1]);
            else if (prop === "in") q.filters.push((r) => (a[1] as unknown[]).includes(r[a[0] as string]));
            else if (prop === "is") q.filters.push((r) => (r[a[0] as string] ?? null) === a[1]);
            else if (prop === "insert") q.insert = a[0] as Row;
            else if (prop === "maybeSingle" || prop === "single") q.one = true;
            return chain;
          };
        },
      },
    );
    return chain;
  };
  const storage = { from: () => ({ upload: async (path: string, bytes: Buffer) => ((files[path] = bytes.length), { error: null }) }) };
  return { db: { from, storage } as never, tables, files };
}

const templates = SUBSCRIPTION_TEMPLATE_KEYS.map((key) => ({ id: `t-${key}`, key, name: key, kind: "subscription", status: "active", version: 1, default_entity_id: null, entity_match: null, signature_anchors: {}, has_expiry: false }));
const entities = [{ id: "e-venture", legal_name: "ICFO VENTURE GROUP, LLC", short_name: "iCFO Venture Group", address: null, signatory_name: null, signatory_title: null, active: true }];
const fieldRows = [
  { template_id: "t-sub_cover_index", token: "spv_name", label: "SPV name", type: "text", required: true, default_value: null, position_ref: [], sort_order: 0 },
  { template_id: "t-sub_cover_index", token: "company_name", label: "Company", type: "text", required: true, default_value: null, position_ref: [], sort_order: 1 },
];

describe("creating a subscription package", () => {
  let ctx: ReturnType<typeof fakeDb>;
  beforeEach(() => {
    ctx = fakeDb({ contract_templates: templates, contract_entities: entities, contract_template_fields: fieldRows, contract_documents: [] });
  });
  const input = { contactId: "c1", userId: "u1" };

  it("makes a draft of each master and the IRS form PDF for a U.S. entity", async () => {
    const r = await createPackageDocuments(ctx.db, { ...input, profile: { type: "entity", usPerson: true, spouseSigns: false } });
    expect(r.documents.map((d) => d.part)).toEqual(["cover_index", "instructions", "signature_pages", "signature_pages", "forms", "forms", "forms", "forms", "ppm", "agreement"]);
    expect(r.documents.filter((d) => d.kind === "form").map((d) => d.name)).toEqual(["IRS Form W-9", "IRS Form W-8BEN-E", "IRS Form W-8BEN"]);
    expect(r.notes).toEqual([]);
    const drafts = ctx.tables.contract_documents;
    expect(drafts).toHaveLength(10);
    const form = drafts.find((d) => d.source === "upload" && d.title === "IRS Form W-9")!;
    expect(form).toMatchObject({ contact_id: "c1", status: "draft", title: "IRS Form W-9", entity_id: "e-venture", page_count: 6, contract_type: null });
    expect(Object.keys(ctx.files)).toContain(`uploads/${form.id}/original.pdf`);
  });

  it("prefills the SPV and company from the contact", async () => {
    await createPackageDocuments(ctx.db, { ...input, profile: { type: "entity", usPerson: true, spouseSigns: false } });
    const cover = ctx.tables.contract_documents.find((d) => d.template_id === "t-sub_cover_index")!;
    expect(cover.field_values).toMatchObject({ spv_name: "ICFO SOURCE VISION SPV, LLC", company_name: "SOURCE VISION CORP" });
  });

  it("reuses the contact's unsent drafts instead of making new ones", async () => {
    const profile = { type: "entity", usPerson: true, spouseSigns: false } as const;
    const first = await createPackageDocuments(ctx.db, { ...input, profile });
    const again = await createPackageDocuments(ctx.db, { ...input, profile });
    expect(again.documents.map((d) => d.id)).toEqual(first.documents.map((d) => d.id));
    expect(ctx.tables.contract_documents).toHaveLength(10);
  });

  it("a non-U.S. individual: the W-8BEN is included as a form PDF", async () => {
    const r = await createPackageDocuments(ctx.db, { ...input, profile: { type: "individual", usPerson: false, spouseSigns: false } });
    expect(r.documents.filter((d) => d.kind === "form").map((d) => d.name)).toContain("IRS Form W-8BEN");
    expect(r.notes).toEqual([]);
  });

  it("adds the Agreement of Spouse where it applies", async () => {
    const r = await createPackageDocuments(ctx.db, { ...input, profile: { type: "individual", usPerson: true, spouseSigns: true } });
    expect(r.documents.map((d) => d.name)).toContain("sub_sig_spouse");
  });

  it("says so when the masters are not installed", async () => {
    const empty = fakeDb({ contract_templates: [], contract_entities: entities, contract_documents: [] });
    await expect(createPackageDocuments(empty.db, { ...input, profile: { type: "entity", usPerson: true, spouseSigns: false } })).rejects.toBeInstanceOf(PackageMastersMissing);
  });
});
