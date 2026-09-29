/**
 * Odoo-style custom filter spec for the Contacts grid. A FilterSpec is a set of
 * field·operator·value conditions joined by "all" (AND) or "any" (OR). This module is
 * pure (no server imports) so the client can share the field registry, and it compiles
 * a spec into SQL — that happens in Postgres (contacts_spec_where, migration 20260914003),
 * never in TypeScript string-building.
 *
 * The field keys and ops here MUST stay in step with contacts_spec_where; the PGlite test
 * (search-contacts.pg.test.ts) exercises every one of them against real Postgres.
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
  { key: "investorTypes", label: "Investor profile", kind: "facet", facetKey: "investorTypes", ops: ["in", "set"], options: "investorTypes" },
  { key: "operatingStages", label: "Operating stage", kind: "facet", facetKey: "operatingStages", ops: ["in", "set"], options: "operatingStages" },
  // crm_contacts has no created_at; created_on is "YYYY-MM-DD HH:MM:SS" text, which compares
  // correctly against an ISO date string. (Was created_at — every date filter errored.)
  { key: "createdAt", label: "Created on", kind: "date", col: "created_on", ops: ["after", "before"] },
  { key: "assignee", label: "Lead assignee", kind: "assignee", ops: ["set", "not_set"] },
];

export const GROUPABLE_FIELDS = ["type", "country", "leadSource", "industries", "fundingStages", "investorTypes"] as const;

export function fieldDef(key: string): FieldDef | undefined {
  return FIELD_REGISTRY.find((f) => f.key === key);
}

/** Structural check used by the client's custom-filter builder (values are validated in SQL). */
export function isValidCondition(cond: Condition): boolean {
  const def = fieldDef(cond.field);
  if (!def || !def.ops.includes(cond.op)) return false;
  if (cond.op === "set" || cond.op === "not_set") return true;
  const vals = Array.isArray(cond.value) ? cond.value : cond.value != null ? [String(cond.value)] : [];
  return vals.some((v) => String(v).trim() !== "");
}
