/**
 * Derive an investor's operating stage from their investor TYPE.
 *
 * This is an assumption, not a fact, and it is recorded as such: every value written
 * carries a `_stage_source` tag naming the rule that produced it, so staff can tell a
 * derived stage from a stated one and any single rule can be reversed on its own.
 *
 * Why it is worth doing anyway: stage is a 25-point weight that was empty for ~99.9% of
 * the network, so it contributed nothing to ranking. And because /fit's investor-type
 * question defaults to "Open to any", the type weight usually gives every investor the
 * same 15 points — so a stage derived from type does add real discrimination rather than
 * double-counting a signal already scored. (That last point is why the objection to this
 * approach doesn't hold in practice.)
 *
 * Only fills contacts with NO stage under any known label. A stated or extracted stage
 * always wins; this never overwrites.
 *
 * Originally run as one-off SQL. In code it becomes repeatable, so investors synced from
 * Odoo tomorrow get the same treatment instead of the field silently decaying again.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readAllRows, chunk } from "@/lib/supabase/paged";
import { reportDbError } from "@/lib/supabase/report";
import { reindexContacts } from "@/lib/fit/match-index";
import { OP_STAGE_LABEL, OP_STAGE_LABELS } from "@/lib/fit/options";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/** Key the tag is written under, alongside the stage itself. */
export const STAGE_SOURCE_KEY = "_stage_source";

export type StageRule = {
  /** Tag written to _stage_source; also the handle used to undo just this rule. */
  id: string;
  label: string;
  /** Raw type spellings that trigger the rule — Odoo stores several per concept. */
  matches: string[];
  /** Stage values written. Must be STAGE_VOCAB spellings or they will never match. */
  stages: string[];
};

/**
 * The agreed rules. Order matters only for reporting; a contact is filled by the first
 * rule whose type it carries, so more specific types should come first.
 *
 * VC deliberately spans every band: seed VCs are common, and excluding all VCs from
 * pre-revenue founders on an assumption would be worse than the gap it fixes.
 */
export const STAGE_RULES: StageRule[] = [
  { id: "derived:angel", label: "Angel", matches: ["Angel", "Angel Investor"], stages: ["Startup", "Prototype"] },
  { id: "derived:family_office", label: "Family Office", matches: ["Family Office"], stages: ["Expand Growth", "Small Business", "Midsize Company"] },
  { id: "derived:private_equity", label: "Private Equity", matches: ["Private Equity", "PE"], stages: ["Small Business", "Expand Growth", "Midsize Company", "Large Corporation"] },
  { id: "derived:vc", label: "Venture Capital", matches: ["VC", "Venture Capital", "Venture"], stages: ["Startup", "Prototype", "Expand Growth", "Small Business", "Midsize Company"] },
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

/** True when the contact already has a stage under ANY known label — never overwrite. */
export function hasAnyStage(r: Row): boolean {
  const extra = (r.raw?.__profile as { extra?: Record<string, unknown> } | undefined)?.extra ?? {};
  return OP_STAGE_LABELS.some((label) => asList(r.overrides?.[label]).length > 0 || asList(extra[label]).length > 0);
}

/** The rule that applies to a contact, or null. Pure — this is the whole decision. */
export function ruleFor(r: Row, rules: StageRule[] = STAGE_RULES): StageRule | null {
  if (hasAnyStage(r)) return null;
  const types = typesOf(r).map((t) => t.trim().toLowerCase());
  if (types.length === 0) return null;
  return rules.find((rule) => rule.matches.some((m) => types.includes(m.toLowerCase()))) ?? null;
}

export type DerivePlan = { contactId: string; company: string | null; ruleId: string; stages: string[] };

/** Everything the pass would change. Paged; reads only what it needs. */
export async function planStageDerivation(): Promise<{ plan: DerivePlan[]; scanned: number }> {
  const rows = await readAllRows<Row>((from, to) => db().from("crm_contacts")
    .select("id, company, raw, overrides")
    .or("contact_type.eq.investor,module.eq.investor")
    .not("company", "is", null)
    .order("id", { ascending: true })
    .range(from, to), { context: "planStageDerivation: crm_contacts" });

  const plan: DerivePlan[] = [];
  for (const r of rows) {
    const rule = ruleFor(r);
    if (rule) plan.push({ contactId: r.id, company: r.company, ruleId: rule.id, stages: rule.stages });
  }
  return { plan, scanned: rows.length };
}

/** Counts per rule, for the preview readout. Pure. */
export function summarise(plan: DerivePlan[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of plan) out[p.ruleId] = (out[p.ruleId] ?? 0) + 1;
  return out;
}

/**
 * Apply the plan. Writes the stage plus its provenance tag, then reindexes so /fit sees it
 * immediately (an in-app edit doesn't move synced_at, so the incremental rebuild would
 * miss it). Best-effort per contact.
 */
export async function applyStageDerivation(): Promise<{ scanned: number; filled: number; byRule: Record<string, number>; errors: number; firstError: string | null; reindexed: number }> {
  const { plan, scanned } = await planStageDerivation();
  let filled = 0, errors = 0;
  let firstError: string | null = null;
  const byRule: Record<string, number> = {};
  const touched: string[] = [];

  for (const p of plan) {
    // Re-read overrides immediately before writing: the plan is a snapshot, and something
    // else (an approved enrichment) may have given this contact a real stage since.
    const { data: c } = await db().from("crm_contacts").select("overrides").eq("id", p.contactId).maybeSingle();
    const overrides = { ...((c?.overrides as Record<string, unknown> | null) ?? {}) };
    if (OP_STAGE_LABELS.some((l) => Array.isArray(overrides[l]) && (overrides[l] as unknown[]).length > 0)) continue;

    overrides[OP_STAGE_LABEL] = p.stages;
    overrides[STAGE_SOURCE_KEY] = p.ruleId;
    const { error } = await db().from("crm_contacts").update({ overrides }).eq("id", p.contactId);
    if (error) {
      errors++;
      if (!firstError) firstError = `${error.code ?? ""} ${error.message ?? String(error)}`.trim();
      continue;
    }
    filled++;
    byRule[p.ruleId] = (byRule[p.ruleId] ?? 0) + 1;
    touched.push(p.contactId);
  }

  const reindexed = await reindexContacts(touched).catch(() => 0);
  return { scanned, filled, byRule, errors, firstError, reindexed };
}

/** Remove every stage written by one rule, leaving stated and extracted values alone. */
export async function undoStageRule(ruleId: string): Promise<number> {
  const { data, error } = await db().from("crm_contacts")
    .select("id, overrides").eq(`overrides->>${STAGE_SOURCE_KEY}`, ruleId).limit(20000);
  if (reportDbError("undoStageRule: read", error)) return 0;
  const rows = (data ?? []) as Array<{ id: string; overrides: Record<string, unknown> | null }>;
  let n = 0;
  const touched: string[] = [];
  for (const part of chunk(rows, 200)) {
    for (const r of part) {
      const overrides = { ...(r.overrides ?? {}) };
      delete overrides[OP_STAGE_LABEL];
      delete overrides[STAGE_SOURCE_KEY];
      const { error: upErr } = await db().from("crm_contacts").update({ overrides }).eq("id", r.id);
      if (!reportDbError("undoStageRule: update", upErr)) { n++; touched.push(r.id); }
    }
  }
  await reindexContacts(touched).catch(() => 0);
  return n;
}
