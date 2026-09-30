/**
 * The founder's Odoo entrepreneur questionnaire, read from the founder contact's
 * crm_contacts.raw (the `__profile.extra` answers plus a few x_studio fields), with the
 * team's edits from crm_contacts.overrides laid on top. Pure and client-safe: the loaders
 * in db.ts and matching.ts pass the rows in.
 *
 * Two uses:
 *   - the Entrepreneur profile tab lays these out in Odoo's three sections, and each row
 *     carries the overrides key an inline edit saves under;
 *   - the matching queue seeds its filters from them when the project has no iCapOS
 *     company (every Odoo-imported project), which is why matching found nothing.
 *
 * Edits follow the Sales Hub contact page (src/lib/sales/contacts.ts): an array-valued
 * override replaces the synced answer, an empty one clears it, none keeps Odoo's value.
 * Industry saves under "Industries", the key the contacts trigger and the Match campaign
 * view read (migration 20260930115123).
 */
import { Q1_STAGE, Q2_RAISE, Q4_REVENUE, Q5_INVESTOR_TYPE, canonicalInvestorType, type FitAnswers } from "@/lib/fit/options";

export type ProfileValue = string | string[] | null;
/** kind: "list" edits as chips from the field's options, "text" as a text box.
 *  saveKey is null for rows that can't be edited here (Assigned agent is the Odoo owner). */
export type ProfileRow = { label: string; value: ProfileValue; long?: boolean; saveKey: string | null; kind: "list" | "text" };
export type ProfileSection = { title: string; rows: ProfileRow[] };
export type FounderOdooProfile = {
  sections: ProfileSection[];
  companyName: string | null; website: string | null; membership: string | null;
  industries: string[]; seekingAmount: string[]; revenue: string[]; operatingStage: string[]; investorTypes: string[];
  hasQuestionnaire: boolean;
};

type Raw = Record<string, unknown> | null | undefined;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : typeof v === "string" && v.trim() ? [v.trim()] : []);
const m2oName = (v: unknown): string | null => (Array.isArray(v) && typeof v[1] === "string" ? v[1] : null);

/** The synced label an answer lives under, found by keywords (Odoo labels drift: trailing
 *  spaces, "type(s)" vs "types"). */
function pickKey(extra: Record<string, unknown>, ...keys: string[]): string | undefined {
  const entries = Object.keys(extra).map((k) => [norm(k), k] as const);
  for (const key of keys) { const n = norm(key); const hit = entries.find(([k]) => k === n) ?? entries.find(([k]) => k.includes(n)); if (hit) return hit[1]; }
  return undefined;
}
function pick(extra: Record<string, unknown>, ...keys: string[]): unknown {
  const k = pickKey(extra, ...keys);
  return k === undefined ? undefined : extra[k];
}
/** An array-valued override under this label (matched like contacts.ts: trimmed, any case). */
function overrideFor(ov: Record<string, unknown>, label: string | undefined): string[] | undefined {
  if (!label) return undefined;
  const t = label.trim().toLowerCase();
  const k = Object.keys(ov).find((x) => x.trim().toLowerCase() === t);
  const v = k === undefined ? undefined : ov[k];
  return Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : undefined;
}

type RowDef = { label: string; keys: string[]; odoo: string | null; save?: string; text?: boolean; long?: boolean; raw?: (r: Record<string, unknown>) => ProfileValue };
/** Odoo's questionnaire, in Odoo's order. Missing answers stay as rows showing "—", like Odoo.
 *  odoo = the canonical label a blank answer's edit saves under (null = not editable). */
const SECTIONS: Array<{ title: string; rows: RowDef[] }> = [
  { title: "Entrepreneur information", rows: [
    { label: "How did you hear about us?", keys: ["how did you hear about us"], odoo: "Entrepreneur: How did you hear about us?", raw: (r) => (typeof r.x_studio_lead_type === "string" ? r.x_studio_lead_type : null) },
    { label: "If other, who referred you", keys: ["if other please tell us who referred you", "who referred you"], odoo: "Entrepreneur: If other, please tell us who referred you", text: true },
    { label: "iCFO capital partner", keys: ["icfo capital partner"], odoo: "Entrepreneur: iCFO capital partner" },
    { label: "Assigned agent", keys: ["entrepreneur assigned agent", "assigned agent"], odoo: null, raw: (r) => m2oName(r.user_id) },
    { label: "Contact preference", keys: ["entrepreneur contact preference", "contact preference"], odoo: "Entrepreneur contact preference", text: true },
  ] },
  { title: "Agent field (internal use)", rows: [
    { label: "Entrepreneur's note", keys: ["entrepreneur s note"], odoo: "Entrepreneur's note", text: true, raw: (r) => (typeof r.x_studio_entrepreneurs_note === "string" ? r.x_studio_entrepreneurs_note : null) },
    { label: "Entrepreneur's request", keys: ["entrepreneur s request"], odoo: "Entrepreneur's request", text: true, raw: (r) => (typeof r.x_studio_entrepreneurs_request === "string" ? r.x_studio_entrepreneurs_request : null) },
    { label: "Pitch frame to use", keys: ["entrepreneur pitch frame to use", "pitch frame"], odoo: "Entrepreneur pitch frame to use", text: true },
  ] },
  { title: "Entrepreneur", rows: [
    { label: "Seeking type of investor(s)", keys: ["entrepreneur seeking type of investor"], odoo: "Entrepreneur seeking type of investor(s)?" },
    { label: "Seeking type(s) of capital", keys: ["entrepreneur seeking type s of capital", "seeking types of capital"], odoo: "Entrepreneur seeking type(s) of capital?" },
    { label: "Seeking amount of capital", keys: ["entrepreneur seeking amount of capital"], odoo: "Entrepreneur seeking amount of capital?" },
    { label: "Type of industries", keys: ["entrepreneur type of industries"], odoo: "Industries", save: "Industries" },
    { label: "Use of funds", keys: ["entrepreneur use of funds"], odoo: "Entrepreneur use of funds?" },
    { label: "Funding stage", keys: ["entrepreneur funding stage"], odoo: "Entrepreneur funding stage?" },
    { label: "Operating stage", keys: ["entrepreneur operating stage"], odoo: "Entrepreneur operating stage?" },
    { label: "Annual revenue size", keys: ["entrepreneur annual revenue size"], odoo: "Entrepreneur annual revenue size?" },
    { label: "Annual EBITDA", keys: ["entrepreneur annual ebitda"], odoo: "Entrepreneur annual EBITDA?" },
    { label: "Management team experience", keys: ["entrepreneur management team experience"], odoo: "Entrepreneur management team experience?", text: true },
    { label: "Business entity", keys: ["entrepreneur type s of business entity", "business entity"], odoo: "Entrepreneur type(s) of business entity?" },
    { label: "Preferences for active investor", keys: ["entrepreneur preferences for active investor"], odoo: "Entrepreneur preferences for active investor?" },
    { label: "Short bio", keys: ["entrepreneur short bio"], odoo: "Entrepreneur short bio", text: true, long: true },
    { label: "Business summary", keys: ["entrepreneur business summary"], odoo: "Entrepreneur business summary", text: true, long: true },
    { label: "Five key highlights", keys: ["entrepreneur five key highlights"], odoo: "Entrepreneur five key highlights", text: true, long: true },
  ] },
];

export function founderOdooProfile(raw: Raw, overrides?: Record<string, unknown> | null): FounderOdooProfile | null {
  if (!raw) return null;
  const prof = (raw.__profile as Record<string, unknown> | undefined) ?? {};
  const extra = (prof.extra as Record<string, unknown> | undefined) ?? {};
  const ov = overrides && typeof overrides === "object" ? overrides : {};
  const rowOf = (d: RowDef): ProfileRow => {
    const synced = pickKey(extra, ...d.keys);
    const saveKey = d.odoo === null ? null : d.save ?? synced ?? d.odoo;
    // The edit key wins, then an edit made on the contact page under the synced label.
    const edited = (saveKey ? overrideFor(ov, saveKey) : undefined) ?? (d.odoo !== null && synced !== saveKey ? overrideFor(ov, synced) : undefined);
    let value: ProfileValue;
    if (edited) value = edited.length ? (d.text ? edited.join("\n") : edited) : null;
    else {
      const v = synced === undefined ? undefined : extra[synced];
      const list = asList(v);
      value = list.length ? (Array.isArray(v) ? list : list[0]) : d.raw ? d.raw(raw) : null;
    }
    return { label: d.label, value, saveKey, kind: d.text ? "text" : "list", ...(d.long ? { long: true } : {}) };
  };
  const sections: ProfileSection[] = SECTIONS.map((s) => ({ title: s.title, rows: s.rows.map(rowOf) }));
  const listOf = (label: string) => asList(sections.flatMap((s) => s.rows).find((r) => r.label === label)?.value);
  const hasQuestionnaire = Object.keys(extra).some((k) => /^entrepreneur/i.test(k.trim()));
  return {
    sections,
    companyName: asList(pick(extra, "company name"))[0] ?? (typeof raw.x_studio_company_name === "string" ? raw.x_studio_company_name : null) ?? m2oName(raw.parent_id),
    website: typeof raw.website === "string" && raw.website ? raw.website : null,
    membership: typeof prof.membership === "string" ? prof.membership : typeof raw.x_studio_membership_type === "string" ? raw.x_studio_membership_type : null,
    industries: listOf("Type of industries"),
    seekingAmount: listOf("Seeking amount of capital"),
    revenue: listOf("Annual revenue size"),
    operatingStage: listOf("Operating stage"),
    investorTypes: listOf("Seeking type of investor(s)"),
    hasQuestionnaire,
  };
}

/** "$1m - $10m" / "Less than $50k" / "Over $100m" → USD bounds. */
function parseBand(s: string): { min: number; max: number } | null {
  const nums = [...s.toLowerCase().matchAll(/\$?\s*([\d.,]+)\s*([km])?/g)].map((m) => Number(m[1].replace(/,/g, "")) * (m[2] === "m" ? 1e6 : m[2] === "k" ? 1e3 : 1)).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  if (/less than|under|below/i.test(s)) return { min: 0, max: nums[0] };
  if (/over|more than|above|\+/i.test(s)) return { min: nums[0], max: Number.MAX_SAFE_INTEGER };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/**
 * Matching defaults from the questionnaire. Industries pass through (founder and investor
 * answers share Odoo's industry list); the others map onto the /fit option keys.
 */
export function fitDefaultsFromProfile(p: FounderOdooProfile | null, offerable?: string[]): Partial<FitAnswers> {
  if (!p) return {};
  const out: Partial<FitAnswers> = {};
  const inds = offerable ? p.industries.filter((i) => offerable.some((o) => o.toLowerCase() === i.toLowerCase())).map((i) => offerable.find((o) => o.toLowerCase() === i.toLowerCase())!) : p.industries;
  if (inds.length) out.industry = inds;
  const raise = new Set<string>();
  for (const s of p.seekingAmount) { const b = parseBand(s); if (!b) continue; for (const q of Q2_RAISE) if (b.min < q.max && b.max > q.min) raise.add(q.key); }
  if (raise.size) out.raise = [...raise];
  const rev = Q4_REVENUE.filter((q) => p.revenue.some((r) => q.stored.some((s) => s.toLowerCase() === r.toLowerCase()))).map((q) => q.key);
  if (rev.length) out.revenue = rev;
  const stage = Q1_STAGE.filter((q) => p.operatingStage.some((r) => q.stored.some((s) => s.toLowerCase() === r.toLowerCase()))).map((q) => q.key);
  if (stage.length) out.stage = stage;
  const types = new Set<string>();
  for (const t of p.investorTypes) {
    const canon = canonicalInvestorType(t) ?? t;
    const q = Q5_INVESTOR_TYPE.find((o) => o.key !== "any" && o.stored.some((s) => s.toLowerCase() === canon.toLowerCase() || s.toLowerCase() === t.toLowerCase()));
    if (q) types.add(q.key);
  }
  if (types.size) out.investorType = [...types];
  return out;
}
