/**
 * Odoo-style custom filter spec for the Contacts grid. A FilterSpec is a set of
 * field·operator·value conditions joined by "all" (AND) or "any" (OR). This module is
 * pure (no server imports) so the client can share the field registry, and it compiles
 * a spec into PostgREST filter terms that applyContactFilters applies to the query.
 *
 * Compilation avoids negation operators that would be unsafe inside an OR tree — every
 * condition compiles to positive OR-terms, mirroring the proven quoting used elsewhere
 * in applyContactFilters (facet containment, lead-source, etc.).
 */

export type Operator = "contains" | "equals" | "in" | "set" | "not_set" | "after" | "before";

export type Condition = { field: string; op: Operator; value?: string | string[] };
export type FilterSpec = { match: "all" | "any"; conditions: Condition[] };

export const OP_LABEL: Record<Operator, string> = {
  contains: "contains",
  equals: "is",
  in: "is any of",
  set: "is set",
  not_set: "is not set",
  after: "is after",
  before: "is before",
};

type FieldKind = "text" | "enumCol" | "type" | "leadSource" | "facet" | "date" | "assignee";
/** Where the value picker for a field gets its options (UI only). */
export type OptionSource = "countries" | "type" | "leadSource" | "industries" | "capital" | "fundingStages" | "investorTypes" | "operatingStages";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  col?: string;
  facetKey?: string;
  ops: Operator[];
  options?: OptionSource;
};

export const FIELD_REGISTRY: FieldDef[] = [
  { key: "name", label: "Name", kind: "text", col: "name", ops: ["contains", "equals", "set", "not_set"] },
  { key: "company", label: "Company", kind: "text", col: "company", ops: ["contains", "equals", "set", "not_set"] },
  { key: "email", label: "Email", kind: "text", col: "email", ops: ["contains", "equals", "set", "not_set"] },
  { key: "phone", label: "Phone", kind: "text", col: "phone", ops: ["contains", "set", "not_set"] },
  { key: "type", label: "Type", kind: "type", ops: ["in"], options: "type" },
  { key: "country", label: "Country", kind: "enumCol", col: "country", ops: ["in", "set", "not_set"], options: "countries" },
  { key: "leadSource", label: "Lead source", kind: "leadSource", ops: ["in", "set"], options: "leadSource" },
  { key: "industries", label: "Industry", kind: "facet", facetKey: "industries", ops: ["in", "set"], options: "industries" },
  { key: "capital", label: "Amount / type of capital", kind: "facet", facetKey: "capital", ops: ["in", "set"], options: "capital" },
  { key: "fundingStages", label: "Funding stage", kind: "facet", facetKey: "fundingStages", ops: ["in", "set"], options: "fundingStages" },
  { key: "investorTypes", label: "Investor type", kind: "facet", facetKey: "investorTypes", ops: ["in", "set"], options: "investorTypes" },
  { key: "operatingStages", label: "Operating stage", kind: "facet", facetKey: "operatingStages", ops: ["in", "set"], options: "operatingStages" },
  { key: "createdAt", label: "Created on", kind: "date", col: "created_at", ops: ["after", "before"] },
  { key: "assignee", label: "Lead assignee", kind: "assignee", ops: ["set", "not_set"] },
];

export const GROUPABLE_FIELDS = ["type", "country", "leadSource", "industries", "fundingStages", "investorTypes"] as const;

export function fieldDef(key: string): FieldDef | undefined {
  return FIELD_REGISTRY.find((f) => f.key === key);
}

// jsonb containment operand for a single facet value, quoted for or().
function facetJson(v: string): string {
  return `"${JSON.stringify([v]).replace(/"/g, '""')}"`;
}
// Reject values that would break the or() parser (only relevant to unquoted ilike).
function ilikeSafe(v: string): boolean {
  return !!v && !v.includes(",") && !v.includes("(") && !v.includes(")");
}
/**
 * A PostgREST `ilike` term for use inside an or() logic tree — the construction the
 * working global search uses, which survives multi-word values (a double-quoted `eq.`
 * operand does not reliably survive the or() parser, which silently errored the whole
 * count/list query → every group showed 0). ilike is exact here (no % wildcards) but
 * case-insensitive, which also absorbs casing drift between the facet options and the
 * stored value. Reserved-char values fall back to a quoted operand.
 */
function ilikeTerm(col: string, v: string): string {
  const escaped = v.replace(/([%_\\])/g, "\\$1"); // escape ilike wildcards
  if (/[,()]/.test(v)) return `${col}.ilike."${escaped.replace(/"/g, '""')}"`;
  return `${col}.ilike.${escaped}`;
}
function asArray(value: Condition["value"]): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const s = String(value ?? "").trim();
  return s ? [s] : [];
}

/**
 * Compile one condition to a list of PostgREST OR-terms (all OR'd together). Returns
 * null when the condition is incomplete/invalid so it can be skipped.
 */
export function conditionTerms(cond: Condition): string[] | null {
  const def = fieldDef(cond.field);
  if (!def || !def.ops.includes(cond.op)) return null;
  const vals = asArray(cond.value);

  switch (def.kind) {
    case "text": {
      const col = def.col!;
      if (cond.op === "set") return [`${col}.not.is.null`];
      if (cond.op === "not_set") return [`${col}.is.null`];
      if (vals.length === 0) return null;
      if (cond.op === "contains") return ilikeSafe(vals[0]) ? [`${col}.ilike.%${vals[0]}%`] : null;
      if (cond.op === "equals") return [ilikeTerm(col, vals[0])];
      return null;
    }
    case "enumCol": {
      const col = def.col!;
      if (cond.op === "set") return [`${col}.not.is.null`];
      if (cond.op === "not_set") return [`${col}.is.null`];
      if (cond.op === "in") return vals.length ? vals.map((v) => ilikeTerm(col, v)) : null;
      return null;
    }
    case "type": {
      if (cond.op !== "in" || vals.length === 0) return null;
      // Role lives on contact_type or module (either satisfies the type).
      return vals.flatMap((v) => [`contact_type.eq.${v}`, `module.eq.${v}`]);
    }
    case "leadSource": {
      if (cond.op === "set") return ["overrides->>lead_source.not.is.null", "raw->__profile->>leadSource.not.is.null"];
      if (cond.op === "in") return vals.length ? vals.flatMap((v) => [ilikeTerm("overrides->>lead_source", v), ilikeTerm("raw->__profile->>leadSource", v)]) : null;
      return null;
    }
    case "facet": {
      const fk = def.facetKey!;
      if (cond.op === "set") return [`raw->__profile->${fk}.not.is.null`];
      if (cond.op === "in") return vals.length ? vals.map((v) => `raw->__profile->${fk}.cs.${facetJson(v)}`) : null;
      return null;
    }
    case "date": {
      const col = def.col!;
      if (vals.length === 0) return null;
      if (cond.op === "after") return [`${col}.gte.${vals[0]}`];
      if (cond.op === "before") return [`${col}.lte.${vals[0]}`];
      return null;
    }
    case "assignee": {
      if (cond.op === "set") return ["assignee_ids.not.is.null"];
      if (cond.op === "not_set") return ["assignee_ids.is.null"];
      return null;
    }
    default:
      return null;
  }
}

const MAX_CONDITIONS = 20;

/**
 * Apply a FilterSpec to a Supabase query builder. "all" applies each condition as its
 * own OR-group (chained .or() calls AND together); "any" OR's every term into one .or().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilterSpec(query: any, spec: FilterSpec): any {
  if (!spec || !Array.isArray(spec.conditions)) return query;
  const groups = spec.conditions.slice(0, MAX_CONDITIONS).map(conditionTerms).filter((t): t is string[] => !!t && t.length > 0);
  if (groups.length === 0) return query;
  if (spec.match === "any") {
    return query.or(groups.flat().join(","));
  }
  for (const terms of groups) query = query.or(terms.join(","));
  return query;
}

export function isValidCondition(cond: Condition): boolean {
  return conditionTerms(cond) !== null;
}
