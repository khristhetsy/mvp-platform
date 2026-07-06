import type { ContactModule, ContactSource, CrmContact, SourcePage } from "@/lib/crm-connectors/source-types";
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";

// ── Classification config (env-overridable) ─────────────────────────────────
// Primary signal: the member-type field (Studio: x_studio_membership_type with
// values Entrepreneur / Investor / Advisor). Secondary: an "investor profile"
// field that, when populated, marks the contact as an investor even if the
// member type is blank. Tertiary fallback: res.partner.category (Tags).
const MEMBERSHIP_FIELD = process.env.ODOO_MEMBERSHIP_FIELD ?? "x_studio_membership_type";
const FOUNDER_VALUES = (process.env.ODOO_FOUNDER_VALUES ?? "entrepreneur,founder")
  .split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
const INVESTOR_VALUES = (process.env.ODOO_INVESTOR_VALUES ?? "investor")
  .split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
// Fields whose presence implies "this contact is an investor" (their own
// investor profile / deploy preferences). Used to rescue blank-membership rows.
const INVESTOR_SIGNAL_FIELDS = (process.env.ODOO_INVESTOR_SIGNAL_FIELDS ??
  "x_studio_entrepreneur_seeking_type_of_investors," +
  "x_studio_investor_preferences_for_types_of_capital_to_deploy," +
  "x_studio_preferences_for_types_of_funding_round_to_deploy," +
  "x_studio_investor_interested_in_types_of_business_industries")
  .split(",").map((v) => v.trim()).filter(Boolean);

const FOUNDER_TAG = (process.env.ODOO_FOUNDER_TAG ?? "Founder").toLowerCase();
const INVESTOR_TAG = (process.env.ODOO_INVESTOR_TAG ?? "Investor").toLowerCase();

// Human-friendly semantic keys for the important profile fields, so the CRM UI
// can read them reliably. Everything else is still captured under `extra`.
const SEMANTIC_KEYS: Record<string, string> = {
  x_studio_entrepreneur_seeking_type_of_investors: "investorTypes",
  x_studio_entrepreneur_type_of_industries: "industries",
  x_studio_entrepreneur_seeking_types_of_capital: "capital",
  x_studio_entrepreneur_funding_stage: "fundingStages",
  x_studio_entrepreneur_operating_stage: "operatingStages",
  x_studio_entrepreneur_types_of_business_entity: "businessEntity",
  x_studio_member_portal_plan: "plan",
  x_studio_lead_type: "leadSource",
};

// Import contacts that have an email OR a membership type — so no-email
// members (investors/entrepreneurs/advisors without an address on file) are
// still captured. Dedup is on the Odoo id, not email, so this is safe.
const BASE_DOMAIN: unknown[] = ["|", ["email", "!=", false], [MEMBERSHIP_FIELD, "!=", false]];
function deltaDomain(sinceIso: string): unknown[] {
  return ["&", ["write_date", ">", sinceIso], "|", ["email", "!=", false], [MEMBERSHIP_FIELD, "!=", false]];
}

const BASE_FIELDS = [
  "id", "name", "email", "parent_id", "category_id", "user_id", "function", "write_date",
  // Standard contact detail fields, surfaced in the CRM drawer.
  "phone", "mobile", "website", "comment", "city", "country_id", "create_date", "title",
  // Full mailing address.
  "street", "street2", "state_id", "zip",
];
// Studio field ttypes worth mirroring (skip binary/html/text blobs).
const CAPTURE_TTYPES = new Set([
  "selection", "char", "many2one", "many2many", "one2many",
  "float", "integer", "monetary", "boolean", "date", "datetime",
]);

type StudioField = { name: string; label: string; ttype: string; relation: string | null };
type PartnerRow = {
  id: number;
  name?: string | false;
  email?: string | false;
  parent_id?: [number, string] | false;
  category_id?: number[];
  user_id?: [number, string] | false;
  function?: string | false;
  write_date?: string | false;
  [key: string]: unknown;
};

// ── Cached metadata ─────────────────────────────────────────────────────────
let categoryMap: Map<number, string> | null = null;
async function loadCategories(): Promise<Map<number, string>> {
  if (categoryMap) return categoryMap;
  const rows = await executeKw<{ id: number; name: string }[]>(
    "res.partner.category", "search_read", [[], ["id", "name"]], { limit: 5000 },
  );
  categoryMap = new Map(rows.map((r) => [r.id, r.name]));
  return categoryMap;
}

let studioFields: StudioField[] | null = null;
export async function loadStudioFields(): Promise<StudioField[]> {
  if (studioFields) return studioFields;
  const rows = await executeKw<{ name: string; field_description?: string | false; ttype?: string | false; relation?: string | false }[]>(
    "ir.model.fields", "search_read",
    [[["model", "=", "res.partner"], ["name", "like", "x_studio_%"]], ["name", "field_description", "ttype", "relation"]],
    { limit: 500 },
  );
  studioFields = rows
    .filter((r) => CAPTURE_TTYPES.has(String(r.ttype || "")))
    .map((r) => ({ name: r.name, label: String(r.field_description || r.name), ttype: String(r.ttype || ""), relation: (r.relation as string) || null }));
  return studioFields;
}

// Cache id→display_name maps for each relation model referenced by a Studio m2m/m2o.
const relationMaps = new Map<string, Map<number, string>>();
async function loadRelationMap(model: string): Promise<Map<number, string>> {
  const cached = relationMaps.get(model);
  if (cached) return cached;
  let map = new Map<number, string>();
  try {
    const rows = await executeKw<{ id: number; display_name?: string }[]>(
      model, "search_read", [[], ["display_name"]], { limit: 2000 },
    );
    map = new Map(rows.map((r) => [r.id, r.display_name || String(r.id)]));
  } catch {
    // Relation not readable — leave ids unresolved.
  }
  relationMaps.set(model, map);
  return map;
}

/** Preload every relation map used by the Studio fields (one pass, cached). */
async function warmRelations(fields: StudioField[]): Promise<void> {
  const models = [...new Set(fields.filter((f) => f.relation).map((f) => f.relation!))];
  await Promise.all(models.map((m) => loadRelationMap(m)));
}

// ── Value resolution ────────────────────────────────────────────────────────
function resolveField(f: StudioField, value: unknown): string | string[] | number | boolean | null {
  if (value === false || value === null || value === undefined) return null;
  if (f.ttype === "many2one") {
    return Array.isArray(value) ? String(value[1] ?? value[0]) : null;
  }
  if (f.ttype === "many2many" || f.ttype === "one2many") {
    const ids = Array.isArray(value) ? (value as number[]) : [];
    const map = f.relation ? relationMaps.get(f.relation) : null;
    const names = ids.map((id) => (map?.get(id) ?? String(id)));
    return names;
  }
  if (f.ttype === "boolean") return Boolean(value);
  if (["float", "integer", "monetary"].includes(f.ttype)) return Number(value);
  return String(value);
}

type ProfileData = {
  membership: string | null;
  investorTypes?: string[];
  industries?: string[];
  capital?: string[];
  fundingStages?: string[];
  operatingStages?: string[];
  businessEntity?: string[];
  plan?: string | null;
  leadSource?: string | null;
  extra: Record<string, string | string[] | number | boolean>;
};

function buildProfile(row: PartnerRow, fields: StudioField[]): ProfileData {
  const membershipRaw = row[MEMBERSHIP_FIELD];
  const profile: ProfileData = {
    membership: typeof membershipRaw === "string" ? membershipRaw : null,
    extra: {},
  };
  for (const f of fields) {
    if (f.name === MEMBERSHIP_FIELD) continue;
    const resolved = resolveField(f, row[f.name]);
    if (resolved === null || (Array.isArray(resolved) && resolved.length === 0)) continue;
    const key = SEMANTIC_KEYS[f.name];
    if (key) {
      // @ts-expect-error — assigning to known optional keys by string index.
      profile[key] = resolved;
    } else {
      profile.extra[f.label] = resolved;
    }
  }
  return profile;
}

function hasInvestorSignal(row: PartnerRow): boolean {
  return INVESTOR_SIGNAL_FIELDS.some((name) => {
    const v = row[name];
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  });
}

function classify(profile: ProfileData, row: PartnerRow, catNames: string[]): ContactModule {
  const m = (profile.membership ?? "").toLowerCase();
  if (m && FOUNDER_VALUES.some((v) => m.includes(v))) return "founder";
  if (m && INVESTOR_VALUES.some((v) => m.includes(v))) return "investor";
  // Blank membership → infer investor from their profile signals.
  if (!m && (hasInvestorSignal(row) || (profile.investorTypes?.length ?? 0) > 0)) return "investor";
  // Tag fallback.
  const lowered = catNames.map((c) => c.toLowerCase());
  if (lowered.some((c) => c.includes(FOUNDER_TAG))) return "founder";
  if (lowered.some((c) => c.includes(INVESTOR_TAG))) return "investor";
  return "unknown";
}

function mapPartner(row: PartnerRow, cats: Map<number, string>, fields: StudioField[]): CrmContact {
  const tagNames = (row.category_id ?? []).map((id) => cats.get(id)).filter((n): n is string => Boolean(n));
  const profile = buildProfile(row, fields);
  const mod = classify(profile, row, tagNames);
  return {
    source: "odoo",
    externalId: String(row.id),
    module: mod,
    name: row.name || null,
    email: row.email || null,
    company: Array.isArray(row.parent_id) ? row.parent_id[1] : row.name || null,
    phone: (typeof row.phone === "string" && row.phone) || (typeof row.mobile === "string" && row.mobile) || null,
    website: (typeof row.website === "string" && row.website) || null,
    stage: null,
    owner: Array.isArray(row.user_id) ? row.user_id[1] : null,
    plan: (typeof profile.plan === "string" ? profile.plan : null) ?? profile.membership,
    tags: tagNames,
    raw: { ...(row as Record<string, unknown>), __profile: profile } as Record<string, unknown>,
  };
}

async function prepare(): Promise<{ cats: Map<number, string>; fields: StudioField[] }> {
  const [cats, fields] = await Promise.all([loadCategories(), loadStudioFields()]);
  await warmRelations(fields);
  return { cats, fields };
}

function fieldList(fields: StudioField[]): string[] {
  return [...BASE_FIELDS, ...fields.map((f) => f.name)];
}

/** Fetch a single partner from Odoo and map it (used to refresh the mirror after a write). */
export async function fetchAndMapPartner(externalId: string): Promise<CrmContact | null> {
  const id = Number(externalId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const { cats, fields } = await prepare();
  const rows = await executeKw<PartnerRow[]>("res.partner", "read", [[id], fieldList(fields)]);
  if (!rows || rows.length === 0) return null;
  return mapPartner(rows[0], cats, fields);
}

export const odooSource: ContactSource = {
  id: "odoo",
  label: "Odoo",
  isConfigured: odooConfigured,

  async test() {
    if (!odooConfigured()) return { ok: false, count: 0, error: "Not configured" };
    try {
      const count = await executeKw<number>("res.partner", "search_count", [BASE_DOMAIN]);
      return { ok: true, count };
    } catch (err) {
      return { ok: false, count: 0, error: err instanceof Error ? err.message : "Connection failed" };
    }
  },

  async fetchPage(cursor, pageSize): Promise<SourcePage> {
    const { cats, fields } = await prepare();
    const offset = Number(cursor ?? 0);
    const rows = await executeKw<PartnerRow[]>(
      "res.partner", "search_read",
      [BASE_DOMAIN, fieldList(fields)],
      { offset, limit: pageSize, order: "write_date desc" },
    );
    return {
      contacts: rows.map((r) => mapPartner(r, cats, fields)),
      nextCursor: rows.length < pageSize ? null : String(offset + pageSize),
    };
  },

  async fetchDelta(sinceIso) {
    const { cats, fields } = await prepare();
    const rows = await executeKw<PartnerRow[]>(
      "res.partner", "search_read",
      [deltaDomain(sinceIso), fieldList(fields)],
      { limit: 5000, order: "write_date desc" },
    );
    return rows.map((r) => mapPartner(r, cats, fields));
  },
};
