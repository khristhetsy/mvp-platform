/**
 * Backfill a contact's firm name and investor type from their Job Position line.
 *
 * Many imported investors carry the PERSON's name in the company column ("Ian Smith")
 * while the real firm sits inside the job title ("Technology Investor at TA Associates").
 * That breaks firm de-dup in matching and starves AI enrichment, which is handed the
 * company name as its main signal.
 *
 * This is a deterministic parse, not an inference: the firm is the right-hand side of a
 * separator, and a type is only set when a type WORD is actually present. "Partner at TA
 * Associates" names no type, so none is written — the same extract-don't-guess rule used
 * for thesis stage in ../fit/enrich-investors.
 *
 * Pure parsing (parseJobTitle, planChange) is unit-tested; the IO helpers are server-only.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readAllRows } from "@/lib/supabase/paged";
import { canonicalInvestorType } from "@/lib/fit/options";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/**
 * Detection rules for a job-title LINE — deliberately stricter than the shared
 * canonicalInvestorType, which is fed an already-type-ish string. Here a bare
 * "Corporate Development Manager" must NOT read as Corporate Venture, so the corporate
 * rule requires the full phrase. The output is passed through canonicalInvestorType
 * anyway, so these spellings can never drift from what the matcher compares.
 * Ordered most-specific first: "corporate venture" must win before plain "venture".
 */
const TYPE_RULES: Array<{ re: RegExp; type: string }> = [
  { re: /\bfamily office\b/i, type: "Family Office" },
  { re: /\bcorporate (venture|vc)\b|\bcvc\b/i, type: "Corporate Venture" },
  { re: /\bprivate equity\b/i, type: "Private Equity" },
  { re: /\b(accelerator|incubator)\b/i, type: "Accelerator" },
  { re: /\bangel\b/i, type: "Angel" },   // \b so "Los Angeles" doesn't match
  { re: /\bventure capital\b|\bventures?\b|\bvc\b/i, type: "VC" },
];

// Right-hand sides that are phrases, not firms ("Investor at Large", "Partner - Self").
const NON_FIRM = new Set([
  "large", "self", "myself", "me", "home", "various", "several", "multiple", "n/a", "na",
  "none", "retired", "independent", "private", "confidential", "undisclosed", "stealth",
  "self employed", "self-employed", "freelance", "various companies",
]);

// Ordered: " at " before the bare punctuation forms, so "Partner, Investor at Acme"
// splits on "at" and keeps the fuller right-hand side.
const SEPARATORS = [/\s+\bat\b\s+/i, /\s+@\s+/, /\s*\|\s*/, /\s+[–—-]\s+/, /\s*,\s*/];

export type JobTitleParse = { firm: string | null; investorType: string | null };

function cleanFirm(s: string): string | null {
  const firm = s.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "").trim();
  if (firm.length < 2 || firm.length > 120) return null;
  if (NON_FIRM.has(firm.toLowerCase())) return null;
  if (!/[a-z]/i.test(firm)) return null;            // digits/punctuation only
  return firm;
}

/** Split a job title into firm + stated investor type. Either may be null. Pure. */
export function parseJobTitle(title: string | null | undefined): JobTitleParse {
  const raw = (title ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return { firm: null, investorType: null };

  let firm: string | null = null;
  for (const sep of SEPARATORS) {
    const m = raw.match(sep);
    if (!m || m.index == null) continue;
    firm = cleanFirm(raw.slice(m.index + m[0].length));
    if (firm) break;
  }

  // Type is read from the WHOLE line: the giveaway word is as often in the firm name
  // ("Aperture Ventures") as in the role ("Angel Investor").
  const investorType = canonicalInvestorType(TYPE_RULES.find((r) => r.re.test(raw))?.type ?? null);
  return { firm, investorType };
}

export type ContactLike = {
  id: string;
  name: string | null;
  company: string | null;
  jobTitle: string | null;
  /** True when the contact already has an investor type from any trusted source. */
  hasType: boolean;
};

export type BackfillChange = {
  contactId: string;
  name: string | null;
  oldCompany: string | null;
  newCompany: string | null;   // null = company left as-is
  newType: string | null;      // null = type left as-is
};

/**
 * Decide what (if anything) to change for one contact. Company is only written when it
 * is empty or is the contact's own name — a real, different firm name is never
 * overwritten by a parse. Returns null when there is nothing to do. Pure.
 */
export function planChange(c: ContactLike): BackfillChange | null {
  const { firm, investorType } = parseJobTitle(c.jobTitle);
  const company = (c.company ?? "").trim();
  const name = (c.name ?? "").trim();
  const companyIsSafeToFill = company === "" || (name !== "" && company.toLowerCase() === name.toLowerCase());
  const newCompany = firm && companyIsSafeToFill && firm.toLowerCase() !== name.toLowerCase() ? firm : null;
  const newType = investorType && !c.hasType ? investorType : null;
  if (!newCompany && !newType) return null;
  return { contactId: c.id, name: c.name, oldCompany: c.company, newCompany, newType };
}

type Row = {
  id: string; name: string | null; company: string | null;
  raw: Record<string, unknown> | null; overrides: Record<string, unknown> | null;
};

/** Job title as the contact page resolves it: override first, then the Odoo field. */
function jobTitleOf(r: Row): string | null {
  const ov = r.overrides?.job_position;
  if (typeof ov === "string" && ov.trim()) return ov.trim();
  for (const k of ["function", "job_position", "title"]) {
    const v = r.raw?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length === 2 && typeof v[1] === "string" && v[1].trim()) return v[1].trim();
  }
  return null;
}
function hasTypeOf(r: Row): boolean {
  const ov = r.overrides?.["Investor type"];
  if (Array.isArray(ov) && ov.length) return true;
  const t = (r.raw?.__profile as { investorTypes?: unknown } | undefined)?.investorTypes;
  return Array.isArray(t) && t.length > 0;
}

/** Every change the backfill would make, for the preview list. Paged — see paged.ts. */
export async function planBackfill(): Promise<{ changes: BackfillChange[]; rowsRead: number }> {
  const rows = await readAllRows<Row>((from, to) => db().from("crm_contacts")
    .select("id, name, company, raw, overrides")
    .or("contact_type.eq.investor,module.eq.investor")
    .order("id", { ascending: true })
    .range(from, to), { context: "planBackfill: crm_contacts" });
  const changes: BackfillChange[] = [];
  for (const r of rows) {
    const change = planChange({ id: r.id, name: r.name, company: r.company, jobTitle: jobTitleOf(r), hasType: hasTypeOf(r) });
    if (change) changes.push(change);
  }
  return { changes, rowsRead: rows.length };
}

/**
 * Apply the plan. Company goes to the crm_contacts column (matching de-dups on it);
 * type goes to overrides["Investor type"] so it survives an Odoo re-sync, exactly like
 * an approved enrichment. Best-effort per row — one bad row doesn't stop the rest.
 */
export async function applyBackfill(): Promise<{ rowsRead: number; scanned: number; companies: number; types: number; errors: number; firstError: string | null }> {
  const { changes, rowsRead } = await planBackfill();
  let companies = 0, types = 0, errors = 0;
  // A failing update used to be swallowed, so "applied 0" was indistinguishable from
  // "nothing to apply". Keep going on error, but count and report the first reason.
  let firstError: string | null = null;
  for (const ch of changes) {
    // NOTE: no updated_at — crm_contacts does not have that column (it has synced_at,
    // written by the connector). Including it failed every update, which is exactly the
    // "Applied — 0 company names" we saw with 73 qualifying rows.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {};
    if (ch.newCompany) patch.company = ch.newCompany;
    if (ch.newType) {
      const { data: c } = await db().from("crm_contacts").select("overrides").eq("id", ch.contactId).maybeSingle();
      patch.overrides = { ...((c?.overrides as Record<string, unknown> | null) ?? {}), "Investor type": [ch.newType] };
    }
    const { error } = await db().from("crm_contacts").update(patch).eq("id", ch.contactId);
    if (error) {
      errors++;
      if (!firstError) firstError = `${error.code ?? ""} ${error.message ?? String(error)}`.trim();
      continue;
    }
    if (ch.newCompany) companies++;
    if (ch.newType) types++;
  }
  return { rowsRead, scanned: changes.length, companies, types, errors, firstError };
}
