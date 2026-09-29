/**
 * The founder's Odoo entrepreneur questionnaire, read from the founder contact's
 * crm_contacts.raw (the `__profile.extra` answers plus a few x_studio fields). Pure and
 * client-safe: the loader in db.ts passes the raw row in.
 *
 * Two uses:
 *   - the Entrepreneur profile tab lays these out in Odoo's three sections;
 *   - the matching queue seeds its filters from them when the project has no iCapOS
 *     company (every Odoo-imported project), which is why matching found nothing.
 */
import { Q1_STAGE, Q2_RAISE, Q4_REVENUE, Q5_INVESTOR_TYPE, canonicalInvestorType, type FitAnswers } from "@/lib/fit/options";

export type ProfileValue = string | string[] | null;
export type ProfileRow = { label: string; value: ProfileValue; long?: boolean };
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

/** Find an answer by keywords (Odoo labels drift: trailing spaces, "type(s)" vs "types"). */
function pick(extra: Record<string, unknown>, ...keys: string[]): unknown {
  const entries = Object.entries(extra).map(([k, v]) => [norm(k), v] as const);
  for (const key of keys) { const n = norm(key); const hit = entries.find(([k]) => k === n) ?? entries.find(([k]) => k.includes(n)); if (hit) return hit[1]; }
  return undefined;
}

/** Odoo's questionnaire, in Odoo's order. Missing answers stay as rows showing "—", like Odoo. */
const SECTIONS: Array<{ title: string; rows: Array<{ label: string; keys: string[]; long?: boolean; raw?: (r: Record<string, unknown>) => ProfileValue }> }> = [
  { title: "Entrepreneur information", rows: [
    { label: "How did you hear about us?", keys: ["how did you hear about us"], raw: (r) => (typeof r.x_studio_lead_type === "string" ? r.x_studio_lead_type : null) },
    { label: "If other, who referred you", keys: ["if other please tell us who referred you", "who referred you"] },
    { label: "iCFO capital partner", keys: ["icfo capital partner"] },
    { label: "Assigned agent", keys: ["entrepreneur assigned agent", "assigned agent"], raw: (r) => m2oName(r.user_id) },
    { label: "Contact preference", keys: ["entrepreneur contact preference", "contact preference"] },
  ] },
  { title: "Agent field (internal use)", rows: [
    { label: "Entrepreneur's note", keys: ["entrepreneur s note"], raw: (r) => (typeof r.x_studio_entrepreneurs_note === "string" ? r.x_studio_entrepreneurs_note : null) },
    { label: "Entrepreneur's request", keys: ["entrepreneur s request"], raw: (r) => (typeof r.x_studio_entrepreneurs_request === "string" ? r.x_studio_entrepreneurs_request : null) },
    { label: "Pitch frame to use", keys: ["entrepreneur pitch frame to use", "pitch frame"] },
  ] },
  { title: "Entrepreneur", rows: [
    { label: "Seeking type of investor(s)", keys: ["entrepreneur seeking type of investor"] },
    { label: "Seeking type(s) of capital", keys: ["entrepreneur seeking type s of capital", "seeking types of capital"] },
    { label: "Seeking amount of capital", keys: ["entrepreneur seeking amount of capital"] },
    { label: "Type of industries", keys: ["entrepreneur type of industries"] },
    { label: "Use of funds", keys: ["entrepreneur use of funds"] },
    { label: "Funding stage", keys: ["entrepreneur funding stage"] },
    { label: "Operating stage", keys: ["entrepreneur operating stage"] },
    { label: "Annual revenue size", keys: ["entrepreneur annual revenue size"] },
    { label: "Annual EBITDA", keys: ["entrepreneur annual ebitda"] },
    { label: "Management team experience", keys: ["entrepreneur management team experience"] },
    { label: "Business entity", keys: ["entrepreneur type s of business entity", "business entity"] },
    { label: "Preferences for active investor", keys: ["entrepreneur preferences for active investor"] },
    { label: "Short bio", keys: ["entrepreneur short bio"], long: true },
    { label: "Business summary", keys: ["entrepreneur business summary"], long: true },
    { label: "Five key highlights", keys: ["entrepreneur five key highlights"], long: true },
  ] },
];

export function founderOdooProfile(raw: Raw): FounderOdooProfile | null {
  if (!raw) return null;
  const prof = (raw.__profile as Record<string, unknown> | undefined) ?? {};
  const extra = (prof.extra as Record<string, unknown> | undefined) ?? {};
  const val = (keys: string[], fromRaw?: (r: Record<string, unknown>) => ProfileValue): ProfileValue => {
    const v = pick(extra, ...keys);
    const list = asList(v);
    if (list.length) return Array.isArray(v) ? list : list[0];
    return fromRaw ? fromRaw(raw) : null;
  };
  const sections: ProfileSection[] = SECTIONS.map((s) => ({ title: s.title, rows: s.rows.map((r) => ({ label: r.label, value: val(r.keys, r.raw), ...(r.long ? { long: true } : {}) })) }));
  const hasQuestionnaire = Object.keys(extra).some((k) => /^entrepreneur/i.test(k.trim()));
  return {
    sections,
    companyName: asList(pick(extra, "company name"))[0] ?? (typeof raw.x_studio_company_name === "string" ? raw.x_studio_company_name : null) ?? m2oName(raw.parent_id),
    website: typeof raw.website === "string" && raw.website ? raw.website : null,
    membership: typeof prof.membership === "string" ? prof.membership : typeof raw.x_studio_membership_type === "string" ? raw.x_studio_membership_type : null,
    industries: asList(pick(extra, "entrepreneur type of industries")),
    seekingAmount: asList(pick(extra, "entrepreneur seeking amount of capital")),
    revenue: asList(pick(extra, "entrepreneur annual revenue size")),
    operatingStage: asList(pick(extra, "entrepreneur operating stage")),
    investorTypes: asList(pick(extra, "entrepreneur seeking type of investor")),
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
