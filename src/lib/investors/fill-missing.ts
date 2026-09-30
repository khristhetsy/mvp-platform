/**
 * Fill missing investor profile fields: the investor counterpart of the founder fill.
 *
 * Two deterministic passes. Both are previewed before anything is written, and every value
 * carries a provenance tag so it can be told apart from a stated value and removed on its
 * own (see undoFill):
 *
 *   1. "stated": the investor's own PitchBook sector notes ("Investor quick notes") mapped
 *      onto the industry vocabulary. Tag: _industry_source = "stated:pitchbook".
 *   2. "guess": funding stage, capital type and business entity, taken from what investors
 *      of the SAME type state in Odoo. A value is used only when at least half of the
 *      same-type investors who answered that field chose it, over a sample of at least
 *      MIN_SAMPLE. Otherwise the field stays blank. Tag: guess:default.
 *
 * Industry is never guessed, and nothing here overwrites a value a contact already has.
 * The /fit matcher does not read funding stage, capital type or business entity for
 * investors, so pass 2 changes what staff see, not how investors rank.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readAllRows, chunk } from "@/lib/supabase/paged";
import { reportDbError } from "@/lib/supabase/report";
import { reindexContacts } from "@/lib/fit/match-index";
import { mergeOverrides } from "@/lib/sales/overrides";
import { canonicalInvestorType } from "@/lib/fit/options";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export const STATED_TAG = "stated:pitchbook";
export const GUESS_TAG = "guess:default";
export const INDUSTRY_KEY = "Industries";
export const INDUSTRY_SOURCE_KEY = "_industry_source";
export const QUICK_NOTES_LABEL = "Investor quick notes";

/** Minimum same-type investors who stated a field before their answers are used. */
export const MIN_SAMPLE = 30;
/** Share of that sample a value must reach to be used. */
export const MIN_SHARE = 0.5;

/**
 * PitchBook sector names (as they appear in "Investor quick notes") → the industry
 * vocabulary (vocabulary_options list "industry"). Exact names only; free text in the
 * notes is ignored rather than interpreted.
 */
export const PITCHBOOK_MAP: Record<string, string> = {
  "software": "Software",
  "software software": "Software",
  "application software": "Software",
  "automation/workflow software": "Enterprise Software",
  "commercial services": "Business Services",
  "other commercial services": "Business Services",
  "services (non-financial)": "Business Services",
  "business products and services (b2b)": "Business Services",
  "service providers": "Business Services",
  "consulting services (b2b)": "Professional Services",
  "media": "Media",
  "media and information services (b2b)": "Media",
  "other financial services": "Financial Services",
  "financial services": "Financial Services",
  "capital markets/institutions": "Financial Services",
  "commercial banks": "Financial Services",
  "insurance": "Insurance",
  "healthcare technology systems": "HealthTech",
  "healthcare devices and supplies": "Medical Devices",
  "healthcare services": "Healthcare",
  "healthcare": "Healthcare",
  "other healthcare": "Healthcare",
  "pharmaceuticals and biotechnology": "Biotechnology/Life Science",
  "biotech": "Biotechnology/Life Science",
  "retail": "Consumer",
  "consumer products and services (b2c)": "Consumer",
  "other consumer products and services": "Consumer",
  "consumer non-durables": "Consumer Products",
  "consumer durables": "Consumer Products",
  "apparel and accessories": "Apparel",
  "commercial products": "Industrial",
  "electrical equipment": "Industrial",
  "containers and packaging": "Industrial",
  "it services": "Data/IoT",
  "information technology": "Data/IoT",
  "other information technology": "Data/IoT",
  "iot": "Data/IoT",
  "communications and networking": "Communications",
  "commercial transportation": "Transportation",
  "transportation": "Transportation",
  "agriculture": "Agriculture",
  "energy": "Energy",
  "energy services": "Energy",
  "energy equipment": "Energy",
  "utilities": "Energy",
  "restaurants": "Food/Hospitality",
  "hotels and leisure": "Food/Hospitality",
  "beverages": "Food/Hospitality",
  "food products": "Food/Hospitality",
  "computer hardware": "Hardware",
  "semiconductors": "Semiconductor",
  "ai": "Artificial Intelligence",
  "construction and engineering": "Construction",
  "buildings and property": "Real Estate",
  "aerospace": "Aerospace",
};

/** Map one quick-notes string to industries. Pure. Unknown phrases are dropped. */
export function industriesFromNotes(note: unknown): string[] {
  if (typeof note !== "string" || !note.trim()) return [];
  const keys = Object.keys(PITCHBOOK_MAP);
  const out: string[] = [];
  for (const part of note.split(/[,;]/)) {
    let k = part.trim().toLowerCase();
    if (!k) continue;
    // PitchBook exports truncate long lists ("Financial Serv..."): accept a truncated
    // name only when exactly one known name starts with it.
    const truncated = /(\.\.\.|\.\.|…)$/.test(k);
    k = k.replace(/(\.\.\.|\.\.|…)$/, "").trim();
    let hit = PITCHBOOK_MAP[k];
    if (!hit && truncated && k.length >= 4) {
      const starts = keys.filter((x) => x.startsWith(k));
      if (starts.length === 1) hit = PITCHBOOK_MAP[starts[0]];
    }
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

/** Coerce an Odoo jsonb value (array, [id,label] pairs, string) to a string list. */
export function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => (Array.isArray(x) && x.length === 2 ? String(x[1]) : String(x))).map((s) => s.trim()).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value).trim()].filter(Boolean);
}

/** The three fields pass 2 fills. `profileKey` is the Odoo field on raw.__profile. */
export const GUESS_FIELDS = [
  { field: "funding_stage", label: "Funding stage", profileKey: "fundingStages", overrideKey: "Funding stage", sourceKey: "_funding_stage_source" },
  { field: "capital_type", label: "Capital type", profileKey: "capital", overrideKey: "Capital type", sourceKey: "_capital_source" },
  { field: "business_entity", label: "Business entity", profileKey: "businessEntity", overrideKey: "Business entity", sourceKey: "_entity_source" },
] as const;
export type GuessField = (typeof GUESS_FIELDS)[number]["field"];

/** The narrow projection every pass reads: never the whole Odoo `raw` record. */
export type FillRow = {
  id: string;
  company: string | null;
  overrides: Record<string, unknown> | null;
  types: unknown;
  industries: unknown;
  fundingStages: unknown;
  capital: unknown;
  businessEntity: unknown;
  extra?: Record<string, unknown> | null;
};
const SELECT_STATS = "id, company, overrides, types:raw->__profile->investorTypes, industries:raw->__profile->industries, fundingStages:raw->__profile->fundingStages, capital:raw->__profile->capital, businessEntity:raw->__profile->businessEntity";
const SELECT_PLAN = `${SELECT_STATS}, extra:raw->__profile->extra`;

/** Canonical type bucket for a contact (overrides win over Odoo), or null. Pure. */
export function typeBucket(r: Pick<FillRow, "overrides" | "types">): string | null {
  const ov = asList(r.overrides?.["Investor type"]);
  const list = ov.length ? ov : asList(r.types);
  for (const t of list) {
    const c = canonicalInvestorType(t);
    if (c) return c;
  }
  return null;
}

export function hasIndustry(r: Pick<FillRow, "overrides" | "industries">): boolean {
  return asList(r.overrides?.[INDUSTRY_KEY]).length > 0 || asList(r.industries).length > 0;
}

function statedValues(r: FillRow, f: (typeof GUESS_FIELDS)[number]): string[] {
  return asList((r as Record<string, unknown>)[f.profileKey]);
}
export function hasGuessField(r: FillRow, f: (typeof GUESS_FIELDS)[number]): boolean {
  return asList(r.overrides?.[f.overrideKey]).length > 0 || statedValues(r, f).length > 0;
}

export type FieldDefault = { sample: number; values: { value: string; share: number }[] };
export type TypeDefaults = Record<string, Partial<Record<GuessField, FieldDefault>>>;

/**
 * Per type bucket and field: the values at least MIN_SHARE of same-type investors who
 * STATED the field chose. Only Odoo-stated values count, never our own guesses, so a
 * second run can't feed on the first. Pure.
 */
export function computeTypeDefaults(rows: FillRow[], opts: { minShare?: number; minSample?: number } = {}): TypeDefaults {
  const minShare = opts.minShare ?? MIN_SHARE;
  const minSample = opts.minSample ?? MIN_SAMPLE;
  const counts = new Map<string, { n: number; freq: Map<string, number> }>();
  for (const r of rows) {
    const bucket = typeBucket(r);
    if (!bucket) continue;
    for (const f of GUESS_FIELDS) {
      const vals = [...new Set(statedValues(r, f))];
      if (vals.length === 0) continue;
      const key = `${bucket}\u0000${f.field}`;
      const c = counts.get(key) ?? { n: 0, freq: new Map() };
      c.n++;
      for (const v of vals) c.freq.set(v, (c.freq.get(v) ?? 0) + 1);
      counts.set(key, c);
    }
  }
  const out: TypeDefaults = {};
  for (const [key, c] of counts) {
    const [bucket, field] = key.split("\u0000") as [string, GuessField];
    if (c.n < minSample) continue;
    const values = [...c.freq.entries()]
      .map(([value, k]) => ({ value, share: k / c.n }))
      .filter((v) => v.share >= minShare)
      .sort((a, b) => b.share - a.share || a.value.localeCompare(b.value));
    if (values.length === 0) continue;
    (out[bucket] ??= {})[field] = { sample: c.n, values };
  }
  return out;
}

export type FillStep = "stated" | "guess";
export type FillItem = {
  contactId: string; company: string | null; step: FillStep; field: string;
  key: string; values: string[]; sourceKey: string; tag: string;
};

/** What one contact would receive from one step. Pure. */
export function itemsFor(r: FillRow, step: FillStep, defaults: TypeDefaults = {}): FillItem[] {
  if (step === "stated") {
    if (hasIndustry(r)) return [];
    const values = industriesFromNotes(r.extra?.[QUICK_NOTES_LABEL]);
    if (values.length === 0) return [];
    return [{ contactId: r.id, company: r.company, step, field: "industry", key: INDUSTRY_KEY, values, sourceKey: INDUSTRY_SOURCE_KEY, tag: STATED_TAG }];
  }
  const bucket = typeBucket(r);
  if (!bucket) return [];
  const out: FillItem[] = [];
  for (const f of GUESS_FIELDS) {
    const d = defaults[bucket]?.[f.field];
    if (!d || hasGuessField(r, f)) continue;
    out.push({ contactId: r.id, company: r.company, step, field: f.field, key: f.overrideKey, values: d.values.map((v) => v.value), sourceKey: f.sourceKey, tag: GUESS_TAG });
  }
  return out;
}

const PAGE = 500;

function investorQuery(select: string) {
  return db().from("crm_contacts").select(select)
    .or("contact_type.eq.investor,module.eq.investor")
    .not("company", "is", null);
}

let defaultsCache: { at: number; defaults: TypeDefaults } | null = null;
const DEFAULTS_TTL_MS = 10 * 60 * 1000;

/** Same-type statistics over the whole network. Narrow columns, cached for 10 minutes. */
export async function loadTypeDefaults(fresh = false): Promise<TypeDefaults> {
  if (!fresh && defaultsCache && Date.now() - defaultsCache.at < DEFAULTS_TTL_MS) return defaultsCache.defaults;
  const rows = await readAllRows<FillRow>((from, to) => investorQuery(SELECT_STATS)
    .order("id", { ascending: true }).range(from, to), { context: "loadTypeDefaults" });
  const defaults = computeTypeDefaults(rows);
  defaultsCache = { at: Date.now(), defaults };
  return defaults;
}

/**
 * Walk investors by keyset cursor and collect the work for one step. Stops once `wanted`
 * contacts have work and reports where it stopped, so apply walks the table once in total.
 */
export async function planFill(step: FillStep, opts: { afterId?: string | null; wanted?: number; defaults?: TypeDefaults } = {}): Promise<{ items: FillItem[]; scanned: number; nextCursor: string | null; done: boolean }> {
  const wanted = opts.wanted ?? Number.POSITIVE_INFINITY;
  const defaults = step === "guess" ? (opts.defaults ?? await loadTypeDefaults()) : {};
  const items: FillItem[] = [];
  const withWork = new Set<string>();
  let scanned = 0;
  let cursor: string | null = opts.afterId ?? null;
  for (let page = 0; page < 100; page++) {
    const fetchPage = () => {
      let q = investorQuery(step === "stated" ? SELECT_PLAN : SELECT_STATS);
      if (cursor) q = q.gt("id", cursor);
      return q.order("id", { ascending: true }).limit(PAGE);
    };
    let { data, error } = await fetchPage();
    if (error?.code === "57014") {   // statement timeout: retry the page once
      await new Promise((resolve) => setTimeout(resolve, 750));
      ({ data, error } = await fetchPage());
    }
    if (reportDbError(`planFill(${step})`, error)) return { items, scanned, nextCursor: cursor, done: false };
    const rows = (data ?? []) as FillRow[];
    for (const r of rows) {
      scanned++;
      cursor = r.id;
      const got = itemsFor(r, step, defaults);
      if (got.length === 0) continue;
      items.push(...got);
      withWork.add(r.id);
      if (withWork.size >= wanted) return { items, scanned, nextCursor: cursor, done: false };
    }
    if (rows.length < PAGE) return { items, scanned, nextCursor: null, done: true };
  }
  return { items, scanned, nextCursor: cursor, done: false };
}

/** Counts per field, for the preview readout. Pure. */
export function countByField(items: FillItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) out[i.field] = (out[i.field] ?? 0) + 1;
  return out;
}

const WRITE_CONCURRENCY = 6;
const MAX_PER_RUN = 300;

/** Write one capped slice of a step. Re-checks each contact just before writing. */
export async function applyFill(step: FillStep, opts: { afterId?: string | null } = {}): Promise<{ scanned: number; contacts: number; fields: number; byField: Record<string, number>; errors: number; nextCursor: string | null; done: boolean }> {
  const defaults = step === "guess" ? await loadTypeDefaults() : {};
  const { items, scanned, nextCursor, done } = await planFill(step, { afterId: opts.afterId, wanted: MAX_PER_RUN, defaults });
  const byContact = new Map<string, FillItem[]>();
  for (const i of items) byContact.set(i.contactId, [...(byContact.get(i.contactId) ?? []), i]);
  const todo = [...byContact.keys()];

  let contacts = 0, fields = 0, errors = 0, cur = 0;
  const byField: Record<string, number> = {};
  const touched: string[] = [];
  async function worker() {
    while (cur < todo.length) {
      const id = todo[cur++];
      // The plan is a snapshot: an approval or a sync may have filled the field since.
      const { data: fresh, error } = await db().from("crm_contacts").select(SELECT_PLAN).eq("id", id).maybeSingle();
      if (error || !fresh) { errors++; continue; }
      const now = itemsFor(fresh as FillRow, step, defaults);
      if (now.length === 0) continue;
      const set: Record<string, unknown> = {};
      for (const i of now) { set[i.key] = i.values; set[i.sourceKey] = i.tag; byField[i.field] = (byField[i.field] ?? 0) + 1; }
      const merged = await mergeOverrides(id, { set }, `applyFill(${step})`);
      if (merged === null) { errors++; continue; }
      contacts++; fields += now.length; touched.push(id);
    }
  }
  await Promise.all(Array.from({ length: Math.min(WRITE_CONCURRENCY, todo.length) }, () => worker()));
  // Industries feed /fit, so publish them now. Pass 2 fields aren't in the index.
  if (step === "stated" && touched.length) await reindexContacts(touched).catch(() => 0);
  return { scanned, contacts, fields, byField, errors, nextCursor, done };
}

/** Remove everything one step wrote (optionally one guessed field), leaving all else. */
export async function undoFill(step: FillStep, field?: string): Promise<number> {
  const targets = step === "stated"
    ? [{ key: INDUSTRY_KEY, sourceKey: INDUSTRY_SOURCE_KEY, tag: STATED_TAG }]
    : GUESS_FIELDS.filter((f) => !field || f.field === field).map((f) => ({ key: f.overrideKey, sourceKey: f.sourceKey, tag: GUESS_TAG }));
  let removed = 0;
  const touched: string[] = [];
  for (const t of targets) {
    const rows = await readAllRows<{ id: string }>((from, to) => db().from("crm_contacts")
      .select("id").eq(`overrides->>${t.sourceKey}`, t.tag)
      .order("id", { ascending: true }).range(from, to), { context: "undoFill: read" });
    for (const part of chunk(rows.map((r) => r.id), WRITE_CONCURRENCY)) {
      const res = await Promise.all(part.map((id) => mergeOverrides(id, { remove: [t.key, t.sourceKey] }, "undoFill")));
      res.forEach((m, i) => { if (m !== null) { removed++; touched.push(part[i]); } });
    }
  }
  if (step === "stated" && touched.length) await reindexContacts(touched).catch(() => 0);
  return removed;
}
