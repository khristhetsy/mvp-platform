// Shared "Group by" model for the Sales Hub Contacts list.
//
// One source of truth for every group-by dimension, used by:
//   • the client dropdown (GROUP_BY_OPTIONS — id/label/section only)
//   • the group-list endpoint (extract() to bucket the filtered set + count)
//   • the contacts list endpoint (applyGroupFilter() to page within one group)
//
// Extract and filter are pure — they take a lightweight row / a PostgREST query
// builder — so there is nothing server-only here and both routes can import it.

export const NONE = "__none__";

// PostgREST select for the lightweight aggregation query (group-list endpoint).
// Only the columns any dimension needs — no full `raw`, no last-message lookups.
export const AGG_SELECT =
  "id, contact_type, module, country, company, source, created_on, assignee_ids, profile:raw->__profile, lead_override:overrides->lead_source";

export type LiteRow = {
  id: string;
  contact_type: string | null;
  module: string | null;
  country: string | null;
  company: string | null;
  source: string | null;
  created_on: string | null;
  assignee_ids: string[] | null;
  profile: Record<string, unknown> | null;
  lead_override: unknown;
};

export type GroupSection = "profile" | "facets" | "crm";

function roleOf(r: LiteRow): string {
  const v = (r.contact_type || r.module || "other").toString().toLowerCase();
  return v === "founder" || v === "investor" || v === "advisor" ? v : "other";
}

function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function leadSourceOf(r: LiteRow): string {
  const ov = typeof r.lead_override === "string" ? r.lead_override.trim() : "";
  if (ov) return ov;
  const ls = r.profile?.leadSource;
  return typeof ls === "string" && ls.trim() ? ls.trim() : "";
}

const ROLE_LABEL: Record<string, string> = { founder: "Founders", investor: "Investors", advisor: "Advisors", other: "Other" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Dim = {
  id: string;
  label: string;
  section: GroupSection;
  /** The bucket value(s) a row belongs to. Empty array → the row is "Unassigned". */
  extract: (r: LiteRow) => string[];
  /** Narrow a PostgREST query to a single bucket value (or NONE). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyFilter: (query: any, value: string) => any;
  /** Whether bucket values are opaque ids that need a display label (assignees). */
  needsNames?: boolean;
};

// Facet dimension factory (jsonb array under raw.__profile.<key>).
function facetDim(id: string, key: string, label: string): Dim {
  return {
    id, label, section: "facets",
    extract: (r) => strArray(r.profile?.[key]),
    applyFilter: (query, value) =>
      value === NONE
        ? query.or(`raw->__profile->${key}.is.null`)
        : query.or(`raw->__profile->${key}.cs.["${value.replace(/["\\]/g, "")}"]`),
  };
}

export const GROUP_DIMS: Record<string, Dim> = {
  profile: {
    id: "profile", label: "Profile", section: "profile",
    extract: (r) => [roleOf(r)],
    applyFilter: (query, value) => query.or(`contact_type.eq.${value},module.eq.${value}`),
  },
  industries: facetDim("industries", "industries", "Industry"),
  investorTypes: facetDim("investorTypes", "investorTypes", "Investor type"),
  capital: facetDim("capital", "capital", "Amount / type of capital"),
  fundingStages: facetDim("fundingStages", "fundingStages", "Funding stage"),
  operatingStages: facetDim("operatingStages", "operatingStages", "Operating stage"),
  leadSource: {
    id: "leadSource", label: "Lead source", section: "facets",
    extract: (r) => { const v = leadSourceOf(r); return v ? [v] : []; },
    applyFilter: (query, value) =>
      value === NONE
        ? query.or(`raw->__profile->>leadSource.is.null`)
        : query.or(`overrides->>lead_source.eq.${value},raw->__profile->>leadSource.eq.${value}`),
  },
  country: {
    id: "country", label: "Country", section: "crm",
    extract: (r) => (r.country ? [r.country] : []),
    applyFilter: (query, value) => (value === NONE ? query.is("country", null) : query.eq("country", value)),
  },
  company: {
    id: "company", label: "Company", section: "crm",
    extract: (r) => (r.company ? [r.company] : []),
    applyFilter: (query, value) => (value === NONE ? query.is("company", null) : query.eq("company", value)),
  },
  source: {
    id: "source", label: "Source system", section: "crm",
    extract: (r) => (r.source ? [r.source] : []),
    applyFilter: (query, value) => (value === NONE ? query.is("source", null) : query.eq("source", value)),
  },
  assignees: {
    id: "assignees", label: "Salesperson / owner", section: "crm", needsNames: true,
    extract: (r) => (Array.isArray(r.assignee_ids) ? r.assignee_ids : []),
    applyFilter: (query, value) =>
      value === NONE ? query.or("assignee_ids.is.null,assignee_ids.eq.{}") : query.contains("assignee_ids", [value]),
  },
  createdMonth: {
    id: "createdMonth", label: "Added (month)", section: "crm",
    extract: (r) => (r.created_on ? [String(r.created_on).slice(0, 7)] : []),
    applyFilter: (query, value) => {
      if (value === NONE) return query.is("created_on", null);
      const [y, m] = value.split("-").map(Number);
      if (!y || !m) return query;
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      const end = `${ny}-${String(nm).padStart(2, "0")}-01`;
      return query.gte("created_on", start).lt("created_on", end);
    },
  },
};

export const GROUP_BY_ORDER = [
  "profile",
  "industries", "investorTypes", "capital", "fundingStages", "operatingStages", "leadSource",
  "country", "company", "source", "assignees", "createdMonth",
] as const;

// Client-facing option list (no functions).
export const GROUP_BY_OPTIONS: { id: string; label: string; section: GroupSection }[] =
  GROUP_BY_ORDER.map((id) => ({ id, label: GROUP_DIMS[id].label, section: GROUP_DIMS[id].section }));

export function isGroupBy(v: string | null | undefined): v is keyof typeof GROUP_DIMS {
  return !!v && Object.prototype.hasOwnProperty.call(GROUP_DIMS, v);
}

// Human label for a bucket value (assignee names via ctx, month formatting, NONE).
export function bucketLabel(dimId: string, value: string, nameById?: Map<string, string>): string {
  if (value === NONE) return "Unassigned";
  if (dimId === "profile") return ROLE_LABEL[value] ?? value;
  if (dimId === "assignees") return nameById?.get(value) ?? "Member";
  if (dimId === "createdMonth") {
    const [y, m] = value.split("-").map(Number);
    return y && m ? `${MONTHS[m - 1]} ${y}` : value;
  }
  return value;
}

// Aggregate the filtered lightweight rows into { value, count } buckets for a dim.
export function bucketRows(rows: LiteRow[], dimId: string): { value: string; count: number }[] {
  const dim = GROUP_DIMS[dimId];
  if (!dim) return [];
  const counts = new Map<string, number>();
  for (const r of rows) {
    const vals = dim.extract(r);
    const keys = vals.length ? vals : [NONE];
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  // Sort by count desc, Unassigned last.
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (a.value === NONE ? 1 : b.value === NONE ? -1 : b.count - a.count));
}
