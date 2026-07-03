import type { ContactModule, ContactSource, CrmContact, SourcePage } from "@/lib/crm-connectors/source-types";
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";

// Which Odoo res.partner.category names mark founders vs investors. Configurable
// so this works against any Odoo tagging scheme without code changes.
const FOUNDER_TAG = (process.env.ODOO_FOUNDER_TAG ?? "Founder").toLowerCase();
const INVESTOR_TAG = (process.env.ODOO_INVESTOR_TAG ?? "Investor").toLowerCase();

const PARTNER_FIELDS = ["id", "name", "email", "parent_id", "category_id", "user_id", "function", "write_date"];

type PartnerRow = {
  id: number;
  name?: string | false;
  email?: string | false;
  parent_id?: [number, string] | false;
  category_id?: number[];
  user_id?: [number, string] | false;
  function?: string | false;
  write_date?: string | false;
};

// Cache the category id → name map for the process lifetime.
let categoryMap: Map<number, string> | null = null;
async function loadCategories(): Promise<Map<number, string>> {
  if (categoryMap) return categoryMap;
  const rows = await executeKw<{ id: number; name: string }[]>(
    "res.partner.category",
    "search_read",
    [[], ["id", "name"]],
    { limit: 2000 },
  );
  categoryMap = new Map(rows.map((r) => [r.id, r.name]));
  return categoryMap;
}

function classify(catNames: string[]): ContactModule {
  const lowered = catNames.map((c) => c.toLowerCase());
  if (lowered.some((c) => c.includes(FOUNDER_TAG))) return "founder";
  if (lowered.some((c) => c.includes(INVESTOR_TAG))) return "investor";
  return "unknown";
}

function mapPartner(row: PartnerRow, cats: Map<number, string>): CrmContact {
  const tagNames = (row.category_id ?? []).map((id) => cats.get(id)).filter((n): n is string => Boolean(n));
  return {
    source: "odoo",
    externalId: String(row.id),
    module: classify(tagNames),
    name: row.name || null,
    email: row.email || null,
    company: Array.isArray(row.parent_id) ? row.parent_id[1] : row.name || null,
    stage: null, // crm.lead pipeline join is a follow-up
    owner: Array.isArray(row.user_id) ? row.user_id[1] : null,
    plan: null,
    tags: tagNames,
    raw: row as unknown as Record<string, unknown>,
  };
}

export const odooSource: ContactSource = {
  id: "odoo",
  label: "Odoo",
  isConfigured: odooConfigured,

  async test() {
    if (!odooConfigured()) return { ok: false, count: 0, error: "Not configured" };
    try {
      const count = await executeKw<number>("res.partner", "search_count", [[["email", "!=", false]]]);
      return { ok: true, count };
    } catch (err) {
      return { ok: false, count: 0, error: err instanceof Error ? err.message : "Connection failed" };
    }
  },

  async fetchPage(cursor, pageSize): Promise<SourcePage> {
    const cats = await loadCategories();
    const offset = Number(cursor ?? 0);
    const rows = await executeKw<PartnerRow[]>(
      "res.partner",
      "search_read",
      [[["email", "!=", false]], PARTNER_FIELDS],
      { offset, limit: pageSize, order: "write_date desc" },
    );
    return {
      contacts: rows.map((r) => mapPartner(r, cats)),
      nextCursor: rows.length < pageSize ? null : String(offset + pageSize),
    };
  },

  async fetchDelta(sinceIso) {
    const cats = await loadCategories();
    const rows = await executeKw<PartnerRow[]>(
      "res.partner",
      "search_read",
      [[["email", "!=", false], ["write_date", ">", sinceIso]], PARTNER_FIELDS],
      { limit: 5000, order: "write_date desc" },
    );
    return rows.map((r) => mapPartner(r, cats));
  },
};
