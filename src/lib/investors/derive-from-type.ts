/**
 * Derive missing investor criteria from the investor's TYPE.
 *
 * These are assumptions, not facts, and are recorded as such: every value written carries
 * a provenance tag naming the rule that produced it, so staff can tell a derived value
 * from a stated one and any single rule/field can be reversed on its own.
 *
 * Why it earns its place: stage was a 25-point weight sitting empty for ~99.9% of the
 * network, contributing nothing to ranking. And because /fit's investor-type question
 * defaults to "Open to any", the type weight usually awards every investor the same 15
 * points — so a value derived from type does add real discrimination rather than
 * double-counting something already scored.
 *
 * A field is only filled when the contact has NO value for it under any known label or
 * keyword. Stated and AI-extracted values always win; this never overwrites.
 *
 * Originally run as one-off SQL. In code it is repeatable, so investors synced from Odoo
 * tomorrow get the same treatment instead of the fields silently decaying again.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readAllRows, chunk } from "@/lib/supabase/paged";
import { reportDbError } from "@/lib/supabase/report";
import { reindexContacts } from "@/lib/fit/match-index";
import { OP_STAGE_LABEL, OP_STAGE_LABELS, INV_SIZE_LABEL, REVENUE_LABEL } from "@/lib/fit/options";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export const EBITDA_LABEL = "Investor preferences for company with annual EBITDA range of?";

/** One field a rule fills, with everything needed to detect "already has a value". */
export type FieldFill = {
  field: string;              // short id, used in the UI and for undo
  /** Label written to. First entry is the write target. */
  labels: readonly string[];
  /** Extra keywords for the "does it already have one?" check — labels drift in Odoo. */
  keywords: readonly string[];
  values: string[];
  /** overrides key holding the provenance tag for this field. */
  sourceKey: string;
  /** Whether /fit scores this field, purely so the UI can say so honestly. */
  weight: number;
};

export type TypeRule = { id: string; label: string; matches: readonly string[]; fills: FieldFill[] };

const stageFill = (values: string[]): FieldFill => ({
  field: "stage", labels: OP_STAGE_LABELS, keywords: ["operating stage", "operational stage"],
  values, sourceKey: "_stage_source", weight: 25,
});

/**
 * The agreed rules. A contact is filled by the FIRST rule whose type it carries, so more
 * specific types come first.
 *
 * VC deliberately spans every stage band: seed VCs are common, and excluding them all
 * from pre-revenue founders on an assumption would be worse than the gap it closes.
 * Private Equity is the only type with size/revenue/EBITDA rules — those cheque and
 * revenue floors are genuinely characteristic of the asset class in a way they are not
 * for, say, a family office.
 */
export const TYPE_RULES: TypeRule[] = [
  {
    id: "derived:angel", label: "Angel", matches: ["Angel", "Angel Investor"],
    fills: [stageFill(["Startup", "Prototype"])],
  },
  {
    id: "derived:family_office", label: "Family Office", matches: ["Family Office"],
    fills: [stageFill(["Expand Growth", "Small Business", "Midsize Company"])],
  },
  {
    id: "derived:private_equity", label: "Private Equity", matches: ["Private Equity", "PE"],
    fills: [
      stageFill(["Small Business", "Expand Growth", "Midsize Company", "Large Corporation"]),
      { field: "size", labels: [INV_SIZE_LABEL], keywords: ["investment size", "check size"],
        values: ["$1m - $10m", "$10m - $50m", "$50m - $100m", "$100m+"],
        sourceKey: "_size_source", weight: 20 },
      // NB "Over $100m" here, "$100m+" above — the two vocabularies genuinely differ, and
      // using the wrong one stores a value that can never match.
      { field: "revenue", labels: [REVENUE_LABEL], keywords: ["annual revenue range"],
        values: ["$1m - $10m", "$10m - $50m", "$50m - $100m", "Over $100m"],
        sourceKey: "_revenue_source", weight: 10 },
      // EBITDA is displayed on the profile but the matcher never reads it — 0 points.
      { field: "ebitda", labels: [EBITDA_LABEL], keywords: ["ebitda"],
        values: ["$1m - $10m", "$10m - $50m", "$50m - $100m", "$100m+"],
        sourceKey: "_ebitda_source", weight: 0 },
    ],
  },
  {
    id: "derived:vc", label: "Venture Capital", matches: ["VC", "Venture Capital", "Venture"],
    fills: [stageFill(["Startup", "Prototype", "Expand Growth", "Small Business", "Midsize Company"])],
  },
];

type Row = {
  id: string; company: string | null;
  raw: Record<string, unknown> | null; overrides: Record<string, unknown> | null;
};

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (Array.isArray(x) && x.length === 2 ? String(x[1]) : String(x))).map((s) => s.trim()).filter(Boolean);
  if (v == null || v === "") return [];
  return [String(v).trim()].filter(Boolean);
}

/** Types on a contact, from overrides or the Odoo profile. Raw spellings, not canonical. */
export function typesOf(r: Row): string[] {
  const ov = r.overrides?.["Investor type"];
  if (Array.isArray(ov) && ov.length) return asList(ov);
  return asList((r.raw?.__profile as { investorTypes?: unknown } | undefined)?.investorTypes);
}

/**
 * True when the contact already has a value for this field — by exact label OR by keyword,
 * in overrides or the Odoo payload. The keyword arm matters: a value stored under a
 * renamed label is still a real value, and overwriting it would destroy information.
 */
export function hasFieldValue(r: Row, fill: FieldFill): boolean {
  const extra = (r.raw?.__profile as { extra?: Record<string, unknown> } | undefined)?.extra ?? {};
  for (const label of fill.labels) {
    if (asList(r.overrides?.[label]).length > 0 || asList(extra[label]).length > 0) return true;
  }
  const hit = (key: string) => fill.keywords.some((k) => key.trim().toLowerCase().includes(k));
  for (const [k, v] of Object.entries(r.overrides ?? {})) if (hit(k) && asList(v).length > 0) return true;
  for (const [k, v] of Object.entries(extra)) if (hit(k) && asList(v).length > 0) return true;
  return false;
}

/** The rule that applies to a contact, by type alone. Pure. */
export function ruleFor(r: Row, rules: TypeRule[] = TYPE_RULES): TypeRule | null {
  const types = typesOf(r).map((t) => t.trim().toLowerCase());
  if (types.length === 0) return null;
  return rules.find((rule) => rule.matches.some((m) => types.includes(m.toLowerCase()))) ?? null;
}

export type PlanItem = { contactId: string; company: string | null; ruleId: string; field: string; label: string; values: string[]; sourceKey: string };

/** Which fields this contact is missing that its rule can fill. Pure. */
export function fillsFor(r: Row, rules: TypeRule[] = TYPE_RULES): PlanItem[] {
  const rule = ruleFor(r, rules);
  if (!rule) return [];
  return rule.fills
    .filter((f) => !hasFieldValue(r, f))
    .map((f) => ({ contactId: r.id, company: r.company, ruleId: rule.id, field: f.field, label: f.labels[0], values: f.values, sourceKey: f.sourceKey }));
}

/** Counts per rule and field, for the preview readout. Pure. */
export function summarise(plan: PlanItem[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const p of plan) {
    out[p.ruleId] ??= {};
    out[p.ruleId][p.field] = (out[p.ruleId][p.field] ?? 0) + 1;
  }
  return out;
}

/** Everything the pass would change. Paged; reads only what it needs. */
export async function planDerivation(): Promise<{ plan: PlanItem[]; scanned: number }> {
  const rows = await readAllRows<Row>((from, to) => db().from("crm_contacts")
    .select("id, company, raw, overrides")
    .or("contact_type.eq.investor,module.eq.investor")
    .not("company", "is", null)
    .order("id", { ascending: true })
    .range(from, to), { context: "planDerivation: crm_contacts" });
  return { plan: rows.flatMap((r) => fillsFor(r)), scanned: rows.length };
}

/**
 * Apply the plan. All fields for one contact are merged into a single update, then the
 * contact is reindexed so /fit sees it without a manual rebuild. Best-effort per contact.
 */
export async function applyDerivation(): Promise<{ scanned: number; contacts: number; fields: number; byRule: Record<string, Record<string, number>>; errors: number; firstError: string | null; reindexed: number }> {
  const { plan, scanned } = await planDerivation();

  const byContact = new Map<string, PlanItem[]>();
  for (const p of plan) byContact.set(p.contactId, [...(byContact.get(p.contactId) ?? []), p]);

  let contacts = 0, fields = 0, errors = 0;
  let firstError: string | null = null;
  const byRule: Record<string, Record<string, number>> = {};
  const touched: string[] = [];

  for (const [contactId, items] of byContact) {
    // Re-read immediately before writing: the plan is a snapshot, and an approved
    // enrichment may have given this contact a real value since it was built.
    const { data: c } = await db().from("crm_contacts").select("raw, overrides").eq("id", contactId).maybeSingle();
    if (!c) continue;
    const fresh: Row = { id: contactId, company: null, raw: c.raw ?? null, overrides: c.overrides ?? null };
    const overrides = { ...((c.overrides as Record<string, unknown> | null) ?? {}) };

    let wrote = 0;
    for (const item of items) {
      const rule = TYPE_RULES.find((r) => r.id === item.ruleId);
      const fill = rule?.fills.find((f) => f.field === item.field);
      if (!fill || hasFieldValue(fresh, fill)) continue;   // someone got there first
      overrides[item.label] = item.values;
      overrides[item.sourceKey] = item.ruleId;
      wrote++;
      byRule[item.ruleId] ??= {};
      byRule[item.ruleId][item.field] = (byRule[item.ruleId][item.field] ?? 0) + 1;
    }
    if (wrote === 0) continue;

    const { error } = await db().from("crm_contacts").update({ overrides }).eq("id", contactId);
    if (error) {
      errors++;
      if (!firstError) firstError = `${error.code ?? ""} ${error.message ?? String(error)}`.trim();
      continue;
    }
    contacts++; fields += wrote; touched.push(contactId);
  }

  const reindexed = await reindexContacts(touched).catch(() => 0);
  return { scanned, contacts, fields, byRule, errors, firstError, reindexed };
}

/**
 * Remove every value one rule wrote for one field, leaving stated and extracted values —
 * and the rule's other fields — untouched.
 */
export async function undoDerivation(ruleId: string, field: string): Promise<number> {
  const rule = TYPE_RULES.find((r) => r.id === ruleId);
  const fill = rule?.fills.find((f) => f.field === field);
  if (!fill) return 0;
  const { data, error } = await db().from("crm_contacts")
    .select("id, overrides").eq(`overrides->>${fill.sourceKey}`, ruleId).limit(20000);
  if (reportDbError("undoDerivation: read", error)) return 0;

  let n = 0;
  const touched: string[] = [];
  for (const part of chunk((data ?? []) as Array<{ id: string; overrides: Record<string, unknown> | null }>, 200)) {
    for (const r of part) {
      const overrides = { ...(r.overrides ?? {}) };
      delete overrides[fill.labels[0]];
      delete overrides[fill.sourceKey];
      const { error: upErr } = await db().from("crm_contacts").update({ overrides }).eq("id", r.id);
      if (!reportDbError("undoDerivation: update", upErr)) { n++; touched.push(r.id); }
    }
  }
  await reindexContacts(touched).catch(() => 0);
  return n;
}

/** Kept so the stage-only entry point still reads clearly at the call sites. */
export const applyStageDerivation = applyDerivation;
export { OP_STAGE_LABEL };
