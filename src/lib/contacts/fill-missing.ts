/**
 * Fill missing founder and investor contact fields (Sales, Contacts, gear menu).
 *
 * Three steps, tried in order of trust. Each is previewed before anything is written,
 * never overwrites a value the contact already has (one exception below), and tags
 * every value it writes so it can be told apart from a stated value and undone:
 *
 *   1. "contact"  Free and instant, from data already on the contact.
 *                 Website from a company email domain   (_website_source = derived:email)
 *                 Country from the phone's calling code (_country_source = derived:phone)
 *                 LinkedIn from the website column or anywhere in the synced record
 *                                                        (_linkedin_source = derived:crm)
 *   2. "website"  Reads the contact's own website (home, /about, /team).
 *                 LinkedIn link found on the site         (site:link)
 *                 Business summary from the meta description (site:meta)
 *                 Then AI over the site text: summary, industry, and for founders the
 *                 management team, each tagged inferred:high|medium|low.
 *                 The one overwrite: an industry that was itself a low guess
 *                 (inferred:low, keyword:low, guess:*) is replaced by a medium or high
 *                 reading of the site. The old value is kept under _industry_prev so undo
 *                 puts it back.
 *   3. "guess"    Same-type statistics. A value is used only when at least half of the
 *                 contacts of the same type who STATED the field chose it, over at least
 *                 MIN_SAMPLE answers. Our own guesses never feed the statistics.
 *                 Founders are grouped by funding stage, investors by investor type.
 *                 Tag: guess:default. Which fields may be guessed is chosen per run.
 *
 * Never filled by any step: email, phone, how they heard about us, referral, iCFO
 * capital partner, assigned agent, contact preference, internal notes, industry by guess.
 *
 * Every written key is also listed under `_cfill_<step>` on the contact, which is what
 * undo reads, so undo removes exactly what a step wrote and nothing else.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readAllRows, chunk } from "@/lib/supabase/paged";
import { reportDbError } from "@/lib/supabase/report";
import { reindexContacts } from "@/lib/fit/match-index";
import { mergeOverrides } from "@/lib/sales/overrides";
import { canonicalInvestorType } from "@/lib/fit/options";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";
import { loadVocabulary } from "@/lib/vocabulary/store";
import { offered, resolveSlug } from "@/lib/vocabulary/lists";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type Role = "founder" | "investor";
export type Step = "contact" | "website" | "guess";
export const STEPS: Step[] = ["contact", "website", "guess"];

export const MIN_SAMPLE = 30;
export const MIN_SHARE = 0.5;

/* ------------------------------------------------------------------ fields */

export type FieldDef = {
  field: string;
  label: string;
  /** Overrides key written (the canonical Odoo label, so the profile shows it in place). */
  key: string;
  sourceKey: string;
  /** Odoo labels (profile.extra) and semantic profile keys that already hold this field. */
  extraLabels: string[];
  profileKeys?: string[];
  /** Offered in the guess step, and whether it is on by default. */
  guess?: { default: boolean };
};

const F = (d: FieldDef) => d;

export const FIELDS: Record<Role, FieldDef[]> = {
  founder: [
    F({ field: "linkedin", label: "LinkedIn", key: "Entrepreneur linkedin url", sourceKey: "_linkedin_source", extraLabels: ["Entrepreneur linkedin url", "Investor linkedin url"] }),
    F({ field: "summary", label: "Business summary", key: "Entrepreneur business summary", sourceKey: "_summary_source", extraLabels: ["Entrepreneur business summary"] }),
    F({ field: "industry", label: "Industry", key: "Industries", sourceKey: "_industry_source", extraLabels: ["Industries", "Entrepreneur type of industries?", "Industry sector"], profileKeys: ["industries"] }),
    F({ field: "team", label: "Management team", key: "Entrepreneur management team experience?", sourceKey: "_team_source", extraLabels: ["Entrepreneur management team experience?"] }),
    F({ field: "investor_types", label: "Type of investor(s)", key: "Entrepreneur seeking type of investor(s)?", sourceKey: "_investor_types_source", extraLabels: ["Entrepreneur seeking type of investor(s)?", "Entrepreneur seeking type of investor(s)? "], profileKeys: ["investorTypes"], guess: { default: true } }),
    F({ field: "capital_types", label: "Type(s) of capital", key: "Entrepreneur seeking type(s) of capital?", sourceKey: "_capital_types_source", extraLabels: ["Entrepreneur seeking type(s) of capital?"], profileKeys: ["capital"], guess: { default: true } }),
    F({ field: "funding_amount", label: "Amount of capital", key: "Entrepreneur seeking amount of capital?", sourceKey: "_funding_amount_source", extraLabels: ["Entrepreneur seeking amount of capital?"], guess: { default: true } }),
    F({ field: "use_of_funds", label: "Use of funds", key: "Entrepreneur use of funds?", sourceKey: "_use_of_funds_source", extraLabels: ["Entrepreneur use of funds?"], guess: { default: true } }),
    F({ field: "entity", label: "Business entity", key: "Entrepreneur type(s) of business entity?", sourceKey: "_entity_source", extraLabels: ["Entrepreneur type(s) of business entity?"], profileKeys: ["businessEntity"], guess: { default: true } }),
    F({ field: "operating_stage", label: "Operating stage", key: "Entrepreneur operating stage?", sourceKey: "_operating_stage_source", extraLabels: ["Entrepreneur operating stage?"], profileKeys: ["operatingStages"], guess: { default: true } }),
    F({ field: "active_pref", label: "Active investor preference", key: "Entrepreneur preferences for active investor?", sourceKey: "_active_pref_source", extraLabels: ["Entrepreneur preferences for active investor?"], guess: { default: true } }),
    F({ field: "revenue", label: "Annual revenue size", key: "Entrepreneur annual revenue size?", sourceKey: "_revenue_source", extraLabels: ["Entrepreneur annual revenue size?"], guess: { default: false } }),
    F({ field: "ebitda", label: "Annual EBITDA", key: "Entrepreneur annual EBITDA?", sourceKey: "_ebitda_source", extraLabels: ["Entrepreneur annual EBITDA?"], guess: { default: false } }),
    F({ field: "arr", label: "ARR", key: "Entrepreneur annual recurring revenue (ARR)?", sourceKey: "_arr_source", extraLabels: ["Entrepreneur annual recurring revenue (ARR)?"], guess: { default: false } }),
    F({ field: "mrr", label: "MRR", key: "Entrepreneur monthly recurring revenue (MRR)?", sourceKey: "_mrr_source", extraLabels: ["Entrepreneur monthly recurring revenue (MRR)?"], guess: { default: false } }),
  ],
  investor: [
    F({ field: "linkedin", label: "LinkedIn", key: "Investor linkedin url", sourceKey: "_linkedin_source", extraLabels: ["Investor linkedin url"] }),
    F({ field: "summary", label: "Investor business summary", key: "Investor business summary", sourceKey: "_summary_source", extraLabels: ["Investor business summary"] }),
    F({ field: "industry", label: "Industry", key: "Industries", sourceKey: "_industry_source", extraLabels: ["Industries", "Investor interested in type(s) of business industries?", "Industry sector"], profileKeys: ["industries"] }),
    F({ field: "use_of_funds", label: "Use of funds", key: "Investor preferences for use of funds?", sourceKey: "_use_of_funds_source", extraLabels: ["Investor preferences for use of funds?"], guess: { default: true } }),
    F({ field: "deals_per_year", label: "Deals per year", key: "Investor preferences for the number of deals per year?", sourceKey: "_deals_source", extraLabels: ["Investor preferences for the number of deals per year?"], guess: { default: true } }),
    F({ field: "team_pref", label: "Management team preference", key: "Investor preferences for the management team?", sourceKey: "_team_pref_source", extraLabels: ["Investor preferences for the management team?"], guess: { default: true } }),
    F({ field: "size", label: "Investment size", key: "Investor investment size?", sourceKey: "_size_source", extraLabels: ["Investor investment size?"], guess: { default: false } }),
    F({ field: "revenue_range", label: "Annual revenue range", key: "Investor preferences for the company with an annual revenue range of?", sourceKey: "_revenue_source", extraLabels: ["Investor preferences for the company with an annual revenue range of?"], guess: { default: false } }),
    F({ field: "ebitda_range", label: "Annual EBITDA range", key: "Investor preferences for company with annual EBITDA range of?", sourceKey: "_ebitda_source", extraLabels: ["Investor preferences for company with annual EBITDA range of?", "Investor preferences for company with annual EBITDA range of? "], guess: { default: false } }),
    F({ field: "arr_range", label: "Preferred ARR range", key: "Investor preferences for the company with an ARR range of?", sourceKey: "_arr_source", extraLabels: ["Investor preferences for the company with an ARR range of?"], guess: { default: false } }),
    F({ field: "mrr_range", label: "Preferred MRR range", key: "Investor preferences for the company with an MRR range of?", sourceKey: "_mrr_source", extraLabels: ["Investor preferences for the company with an MRR range of?"], guess: { default: false } }),
  ],
};

export function fieldDef(role: Role, field: string): FieldDef | undefined {
  return FIELDS[role].find((f) => f.field === field);
}
export function guessableFields(role: Role): FieldDef[] {
  return FIELDS[role].filter((f) => f.guess);
}
export function defaultGuessFields(role: Role): string[] {
  return guessableFields(role).filter((f) => f.guess!.default).map((f) => f.field);
}

/* ------------------------------------------------------------------ rows */

export type FillRow = {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  overrides: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
};
const SELECT = "id, name, company, email, phone, website, country, overrides, profile";

/** Coerce an Odoo jsonb value (array, [id,label] pairs, string, bool) to a string list. Pure. */
export function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => (Array.isArray(x) && x.length === 2 ? String(x[1]) : String(x))).map((s) => s.trim()).filter(Boolean);
  if (value == null || value === "" || value === false) return [];
  return [String(value).trim()].filter(Boolean);
}

function extraOf(r: Pick<FillRow, "profile">): Record<string, unknown> {
  return ((r.profile as { extra?: Record<string, unknown> } | null)?.extra ?? {}) as Record<string, unknown>;
}

/** Values the contact STATED for a field (Odoo record only, never overrides). Pure. */
export function statedValues(r: Pick<FillRow, "profile">, f: FieldDef): string[] {
  const extra = extraOf(r);
  const out: string[] = [];
  const lower = new Map(Object.keys(extra).map((k) => [k.trim().toLowerCase(), k]));
  for (const l of f.extraLabels) {
    const k = lower.get(l.trim().toLowerCase());
    if (k) for (const v of asList(extra[k])) if (!out.includes(v)) out.push(v);
  }
  for (const p of f.profileKeys ?? []) for (const v of asList((r.profile ?? {})[p])) if (!out.includes(v)) out.push(v);
  return out;
}

/** Does the contact have any value for the field, stated or from an override? Pure. */
export function hasField(r: Pick<FillRow, "profile" | "overrides">, f: FieldDef): boolean {
  const ov = r.overrides?.[f.key];
  // An override that is an empty array is a deliberate removal: the field shows empty.
  if (Array.isArray(ov)) return ov.length > 0;
  if (typeof ov === "string" && ov.trim()) return true;
  return statedValues(r, f).length > 0;
}

/* ------------------------------------------------------------------ step 1 helpers */

const GENERIC_DOMAIN = /^(gmail|googlemail|yahoo|ymail|rocketmail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|mail|email|zoho|yandex|qq|163|126|sina|web|orange|free|laposte|sfr|btinternet|comcast|att|verizon|sbcglobal|cox|charter|earthlink|bellsouth|optonline|shaw|rogers|telus|bigpond|naver|daum|hanmail|rediffmail|libero|t-online|seznam|wp|o2|ntlworld|sky|talktalk|virginmedia|juno|netzero|frontier|windstream|mindspring|inbox|fastmail|tutanota|hey)\.[a-z]{2,3}(\.[a-z]{2})?$/i;
/** Our own domains: an internal address says nothing about the contact's company. */
const OWN_DOMAINS = new Set(["myicfos.com", "icapos.com", "icfocapital.com"]);

/** The company domain in an email address, or null for free-mail / internal / malformed. Pure. */
export function companyDomainOf(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  // A mail-server subdomain (mail.acme.com) stands for the company's own domain.
  const d = e.slice(at + 1).replace(/^(www|mail|email|smtp|mx)\./, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return null;
  if (GENERIC_DOMAIN.test(d) || OWN_DOMAINS.has(d)) return null;
  // Some mailboxes live on regional subdomains of a free provider (mail.yahoo.co.jp etc.).
  if (/(^|\.)(gmail|yahoo|hotmail|outlook|aol|icloud)\./.test(d)) return null;
  return d;
}

const SOCIAL_HOSTS = /(^|\.)(linkedin\.com|facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com|angel\.co|wellfound\.com|crunchbase\.com|google\.com|bit\.ly|linktr\.ee)$/i;

/** Host of a website value, or null for empty, malformed or a social profile. Pure. */
export function siteHost(website: string | null | undefined): string | null {
  const w = (website ?? "").trim();
  if (!w) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`).hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || SOCIAL_HOSTS.test(host)) return null;
    return host;
  } catch { return null; }
}

const LINKEDIN_URL = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|company|pub|school)\/[A-Za-z0-9_%\-.]+\/?/i;

/** A LinkedIn profile or company URL in any text or JSON, normalised. Pure. */
export function findLinkedin(text: string | null | undefined): string | null {
  const m = (text ?? "").match(LINKEDIN_URL);
  if (!m) return null;
  return m[0].replace(/^http:/i, "https:").replace(/\/+$/, "");
}

/** North American area codes that are Canada, not the United States. */
const CANADA_AREA = new Set("204 226 236 249 250 257 263 289 306 343 354 365 367 368 382 403 416 418 428 431 437 438 450 460 468 474 506 514 519 548 579 581 584 587 604 613 639 647 672 683 705 709 742 753 778 780 782 807 819 825 867 873 879 902 905".split(" "));
/** +1 area codes that are Caribbean or Pacific nations: not safe to call either country. */
const OTHER_NANP = new Set("242 246 264 268 284 340 345 441 473 649 658 664 670 671 684 721 758 767 784 787 809 829 849 868 869 876 939".split(" "));

const CALLING_CODES: Record<string, string> = {
  "7": "Russia", "20": "Egypt", "27": "South Africa", "30": "Greece", "31": "Netherlands", "32": "Belgium", "33": "France",
  "34": "Spain", "36": "Hungary", "39": "Italy", "40": "Romania", "41": "Switzerland", "43": "Austria", "44": "United Kingdom",
  "45": "Denmark", "46": "Sweden", "47": "Norway", "48": "Poland", "49": "Germany", "51": "Peru", "52": "Mexico", "53": "Cuba",
  "54": "Argentina", "55": "Brazil", "56": "Chile", "57": "Colombia", "58": "Venezuela", "60": "Malaysia", "61": "Australia",
  "62": "Indonesia", "63": "Philippines", "64": "New Zealand", "65": "Singapore", "66": "Thailand", "81": "Japan",
  "82": "South Korea", "84": "Vietnam", "86": "China", "90": "Turkey", "91": "India", "92": "Pakistan", "94": "Sri Lanka",
  "212": "Morocco", "213": "Algeria", "216": "Tunisia", "233": "Ghana", "234": "Nigeria", "254": "Kenya", "255": "Tanzania",
  "256": "Uganda", "351": "Portugal", "352": "Luxembourg", "353": "Ireland", "354": "Iceland", "356": "Malta", "357": "Cyprus",
  "358": "Finland", "359": "Bulgaria", "370": "Lithuania", "371": "Latvia", "372": "Estonia", "380": "Ukraine", "381": "Serbia",
  "385": "Croatia", "386": "Slovenia", "420": "Czech Republic", "421": "Slovakia", "502": "Guatemala", "503": "El Salvador",
  "506": "Costa Rica", "507": "Panama", "591": "Bolivia", "593": "Ecuador", "595": "Paraguay", "598": "Uruguay",
  "852": "Hong Kong", "853": "Macau", "855": "Cambodia", "880": "Bangladesh", "886": "Taiwan", "960": "Maldives",
  "961": "Lebanon", "962": "Jordan", "965": "Kuwait", "966": "Saudi Arabia", "968": "Oman", "971": "United Arab Emirates",
  "972": "Israel", "973": "Bahrain", "974": "Qatar", "977": "Nepal",
};

/**
 * Country from an international phone number. Only numbers written with a country code
 * ("+44 ...", "0044 ...") count: a bare local number could be anywhere. Pure.
 */
export function countryFromPhone(phone: string | null | undefined): string | null {
  const p = (phone ?? "").trim();
  let digits: string;
  if (p.startsWith("+")) digits = p.slice(1).replace(/\D/g, "");
  else if (/^00\d/.test(p.replace(/[\s().-]/g, ""))) digits = p.replace(/\D/g, "").slice(2);
  else return null;
  if (digits.length < 8 || digits.length > 15) return null;
  if (digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    if (digits.length !== 11 || OTHER_NANP.has(area)) return null;
    return CANADA_AREA.has(area) ? "Canada" : "United States";
  }
  for (const len of [3, 2, 1]) {
    const hit = CALLING_CODES[digits.slice(0, len)];
    if (hit) return hit;
  }
  return null;
}

function hasCountry(r: Pick<FillRow, "country" | "overrides">): boolean {
  return Boolean((r.country ?? "").trim() || (typeof r.overrides?.country === "string" && (r.overrides.country as string).trim()));
}

/* ------------------------------------------------------------------ plan items */

export type FillItem = {
  contactId: string;
  name: string | null;
  company: string | null;
  field: string;
  label: string;
  /** Overrides key, or "website" for the column. */
  key: string;
  sourceKey: string;
  values: string[];
  tag: string;
  /** Present when the item replaces an earlier low guess (industry only). */
  previous?: { values: string[]; tag: string | null };
};

function item(r: FillRow, f: { field: string; label: string; key: string; sourceKey: string }, values: string[], tag: string): FillItem {
  return { contactId: r.id, name: r.name, company: r.company, field: f.field, label: f.label, key: f.key, sourceKey: f.sourceKey, values, tag };
}

const WEBSITE_FIELD = { field: "website", label: "Website", key: "website", sourceKey: "_website_source" };
const COUNTRY_FIELD = { field: "country", label: "Country", key: "country", sourceKey: "_country_source" };

/** Step 1 work for one contact. Pure. */
export function contactItems(r: FillRow, role: Role): FillItem[] {
  const out: FillItem[] = [];
  if (!(r.website ?? "").trim()) {
    const d = companyDomainOf(r.email);
    if (d) out.push(item(r, WEBSITE_FIELD, [`https://${d}`], "derived:email"));
  }
  if (!hasCountry(r)) {
    const extraPhone = asList(extraOf(r)["Phone 2"])[0];
    const c = countryFromPhone(r.phone) ?? countryFromPhone(extraPhone);
    if (c) out.push(item(r, COUNTRY_FIELD, [c], "derived:phone"));
  }
  const li = fieldDef(role, "linkedin")!;
  if (!hasField(r, li)) {
    const url = findLinkedin(r.website) ?? findLinkedin(JSON.stringify(r.profile ?? {}));
    if (url) out.push(item(r, li, [url], "derived:crm"));
  }
  return out;
}

/** The site to read for a contact: its website column, else its company email domain. Pure. */
export function siteFor(r: Pick<FillRow, "website" | "email">): string | null {
  return siteHost(r.website) ?? companyDomainOf(r.email);
}

/** Industry tags a site reading may replace: guesses, never stated or reviewed values. */
export function isWeakIndustryTag(tag: unknown): boolean {
  return typeof tag === "string" && /^(inferred:low|keyword:low|guess:)/.test(tag);
}

/** Fields the website step could still fill for this contact. Pure. */
export function websiteTargets(r: FillRow, role: Role): string[] {
  if (!siteFor(r)) return [];
  const out: string[] = [];
  for (const field of role === "founder" ? ["linkedin", "summary", "industry", "team"] : ["linkedin", "summary", "industry"]) {
    const f = fieldDef(role, field)!;
    if (!hasField(r, f)) out.push(field);
    else if (field === "industry" && isWeakIndustryTag(r.overrides?.[f.sourceKey])) out.push(field);
  }
  return out;
}

/* ------------------------------------------------------------------ step 2: website */

export type SitePages = { html: string; text: string };

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

const JUNK_SUMMARY = /(just another wordpress|coming soon|under construction|domain (is )?for sale|buy this domain|parked|site not found|page not found|welcome to nginx|index of \/|lorem ipsum|default web site|account suspended|hugedomains|godaddy)/i;

/** The page's own description (meta or Open Graph), if it reads like one. Pure. */
export function metaDescription(html: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const want of ["description", "og:description", "twitter:description"]) {
    for (const t of tags) {
      const name = /\b(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(t)?.[1]?.toLowerCase();
      if (name !== want) continue;
      const content = /\bcontent\s*=\s*("([^"]*)"|'([^']*)')/i.exec(t);
      const v = decodeEntities((content?.[2] ?? content?.[3] ?? "").replace(/\s+/g, " ").trim());
      if (v.length >= 40 && v.length <= 600 && !JUNK_SUMMARY.test(v)) return v;
    }
  }
  return null;
}

/** A LinkedIn link on the page: a company page first, else a person. Pure. */
export function linkedinFromHtml(html: string): string | null {
  const links = [...html.matchAll(/href\s*=\s*["']([^"']*linkedin\.com\/[^"']+)["']/gi)].map((m) => findLinkedin(decodeEntities(m[1]))).filter((x): x is string => Boolean(x));
  return links.find((l) => /\/company\//i.test(l)) ?? links[0] ?? null;
}

/** Visible text of a page. Pure. */
export function pageText(html: string): string {
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

const UA = "iCapOS-enrichment/1.0 (+https://icapos.com)";

async function fetchHtml(url: string, ms = 4500): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(ms), headers: { "user-agent": UA, accept: "text/html" } });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|text\/plain/i.test(type)) return null;
    return (await res.text()).slice(0, 300000);
  } catch { return null; }
}

/** robots.txt disallows everything for all agents. Pure. */
export function robotsBlocksAll(txt: string): boolean {
  const star = txt.toLowerCase().split(/user-agent:\s*\*/).slice(1).map((b) => b.split(/user-agent:/)[0]).join("\n");
  return /disallow:\s*\/\s*(\n|$)/.test(star);
}

/** Home, /about and /team fetched together, robots respected. Null when nothing loads. */
export async function fetchSite(host: string): Promise<SitePages | null> {
  const base = `https://${host}`;
  const [robots, home, about, team] = await Promise.all([
    fetchHtml(`${base}/robots.txt`, 3000), fetchHtml(base), fetchHtml(`${base}/about`), fetchHtml(`${base}/team`),
  ]);
  if (robots && robotsBlocksAll(robots)) return null;
  const pages = [home, about, team].filter((p): p is string => Boolean(p));
  if (pages.length === 0) return null;
  const text = pages.map(pageText).join(" \n ").replace(/\s+/g, " ").trim().slice(0, 6000);
  return { html: pages.join("\n"), text };
}

export type SiteReading = { summary: string | null; industries: string[]; team: string | null; confidence: number };

/** Parse the AI reply into a reading, clamping industries to the vocabulary. Pure. */
export function parseReading(text: string, industryLabels: string[]): SiteReading | null {
  const m = (text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(m[0]); } catch { return null; }
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && !/^(null|none|n\/a|unknown)$/i.test(v.trim()) ? v.trim().slice(0, max) : null);
  const opts = industryLabels.map((label) => ({ slug: label, label, archived: false }));
  const industries = (Array.isArray(raw.industries) ? raw.industries : [])
    .map((x) => resolveSlug(opts as never, String(x)))
    .filter((x): x is string => Boolean(x))
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, 3);
  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));
  const summary = str(raw.summary, 500);
  return { summary: summary && !JUNK_SUMMARY.test(summary) ? summary : null, industries, team: str(raw.team, 600), confidence };
}

export function band(confidence: number): "high" | "medium" | "low" {
  return confidence >= 85 ? "high" : confidence >= 60 ? "medium" : "low";
}

function systemPrompt(role: Role, industryLabels: string[]): string {
  return [
    `You read the text of a ${role === "founder" ? "startup's" : "investment firm's"} own website and extract facts it states.`,
    "Return STRICT JSON only: {\"summary\": string|null, \"industries\": string[], \"team\": string|null, \"confidence\": 0-100}.",
    role === "founder"
      ? "summary = one or two plain sentences on what the company does and for whom, taken from the text."
      : "summary = one or two plain sentences on what the firm invests in and how, taken from the text.",
    `industries = up to 3 values chosen ONLY from this list: ${industryLabels.join(" | ")}. [] if the text does not show it.`,
    role === "founder"
      ? "team = the founders and leaders the text names, as 'Name (Role)' separated by semicolons, or null if none are named."
      : "team = null.",
    "Use only what the text says. If the text is a parked domain, a login page, or unrelated to a business, return nulls, [] and confidence 0.",
    "confidence = how sure you are that the text is this organisation's own site and your fields reflect it.",
  ].join(" ");
}

export class AiUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "AiUnavailableError"; }
}

/** AI reading of the site text. Throws AiUnavailableError when the AI itself can't run. */
export async function readSite(role: Role, r: FillRow, site: SitePages, industryLabels: string[]): Promise<SiteReading | null> {
  if (!isClaudeConfigured()) throw new AiUnavailableError("AI is not configured.");
  const user = [`Name on file: ${r.company ?? r.name ?? "(unknown)"}`, `Website text: ${site.text.slice(0, 5000)}`].join("\n");
  let reply: string;
  try {
    reply = await claudeComplete([{ role: "user", content: user }], { usage: { category: "enrichment", feature: "contact_fill" }, model: CLAUDE_HAIKU, system: systemPrompt(role, industryLabels), maxTokens: 500, temperature: 0, locale: "en" });
  } catch (e) {
    throw new AiUnavailableError(e instanceof Error ? e.message.slice(0, 200) : "AI request failed.");
  }
  return parseReading(reply, industryLabels);
}

/** Turn what was read from a site into items, respecting what the contact already has. Pure. */
export function websiteItems(r: FillRow, role: Role, site: SitePages | null, reading: SiteReading | null): FillItem[] {
  if (!site) return [];
  const targets = new Set(websiteTargets(r, role));
  const out: FillItem[] = [];
  if (targets.has("linkedin")) {
    const li = linkedinFromHtml(site.html);
    if (li) out.push(item(r, fieldDef(role, "linkedin")!, [li], "site:link"));
  }
  const tag = reading ? `inferred:${band(reading.confidence)}` : "";
  if (targets.has("summary")) {
    const meta = metaDescription(site.html);
    if (meta) out.push(item(r, fieldDef(role, "summary")!, [meta], "site:meta"));
    else if (reading?.summary && reading.confidence >= 60) out.push(item(r, fieldDef(role, "summary")!, [reading.summary], tag));
  }
  if (targets.has("industry") && reading && reading.industries.length) {
    const f = fieldDef(role, "industry")!;
    if (!hasField(r, f)) {
      out.push(item(r, f, reading.industries, tag));
    } else if (reading.confidence >= 60) {
      // Replace a low guess only with a better reading, keeping it for undo.
      const it = item(r, f, reading.industries, tag);
      it.previous = { values: asList(r.overrides?.[f.key]), tag: String(r.overrides?.[f.sourceKey] ?? "") || null };
      out.push(it);
    }
  }
  if (role === "founder" && targets.has("team") && reading?.team && reading.confidence >= 60) {
    out.push(item(r, fieldDef(role, "team")!, [reading.team], tag));
  }
  return out;
}

/* ------------------------------------------------------------------ step 3: guess */

/** The group a contact's statistics come from. Founders: funding stage. Investors: type. Pure. */
export function bucketOf(r: Pick<FillRow, "profile" | "overrides">, role: Role): string | null {
  if (role === "founder") {
    const stated = asList(extraOf(r)["Entrepreneur funding stage?"]);
    const list = stated.length ? stated : asList((r.profile ?? {}).fundingStages);
    const ov = asList(r.overrides?.["Entrepreneur funding stage?"]);
    return (list[0] ?? ov[0] ?? null)?.toLowerCase() ?? null;
  }
  const ov = asList(r.overrides?.["Investor type"]);
  const list = ov.length ? ov : asList((r.profile ?? {}).investorTypes);
  for (const t of list) {
    const c = canonicalInvestorType(t);
    if (c) return c;
  }
  return null;
}

export type FieldDefault = { sample: number; values: { value: string; share: number }[] };
export type Defaults = Record<string, Record<string, FieldDefault>>;
const ALL = "*";

/**
 * Per group and field, the values at least MIN_SHARE of same-group contacts who STATED
 * the field chose. A group "*" (everyone) covers contacts with no group. Pure.
 */
export function computeDefaults(rows: FillRow[], role: Role, opts: { minShare?: number; minSample?: number } = {}): Defaults {
  const minShare = opts.minShare ?? MIN_SHARE;
  const minSample = opts.minSample ?? MIN_SAMPLE;
  const counts = new Map<string, { n: number; freq: Map<string, number> }>();
  const add = (bucket: string, field: string, vals: string[]) => {
    const key = `${bucket}\u0000${field}`;
    const c = counts.get(key) ?? { n: 0, freq: new Map() };
    c.n++;
    for (const v of vals) c.freq.set(v, (c.freq.get(v) ?? 0) + 1);
    counts.set(key, c);
  };
  for (const r of rows) {
    const bucket = bucketOf(r, role);
    for (const f of guessableFields(role)) {
      const vals = [...new Set(statedValues(r, f))];
      if (vals.length === 0) continue;
      add(ALL, f.field, vals);
      if (bucket) add(bucket, f.field, vals);
    }
  }
  const out: Defaults = {};
  for (const [key, c] of counts) {
    const [bucket, field] = key.split("\u0000");
    if (c.n < minSample) continue;
    const values = [...c.freq.entries()].map(([value, k]) => ({ value, share: k / c.n }))
      .filter((v) => v.share >= minShare)
      .sort((a, b) => b.share - a.share || a.value.localeCompare(b.value));
    if (values.length) (out[bucket] ??= {})[field] = { sample: c.n, values };
  }
  return out;
}

/** Guess work for one contact over the chosen fields. Pure. */
export function guessItems(r: FillRow, role: Role, defaults: Defaults, fields: string[]): FillItem[] {
  const bucket = bucketOf(r, role);
  const out: FillItem[] = [];
  for (const f of guessableFields(role)) {
    if (!fields.includes(f.field) || hasField(r, f)) continue;
    const d = (bucket ? defaults[bucket]?.[f.field] : undefined) ?? defaults[ALL]?.[f.field];
    if (!d) continue;
    out.push(item(r, f, d.values.map((v) => v.value), "guess:default"));
  }
  return out;
}

/* ------------------------------------------------------------------ database passes */

const PAGE = 500;

/** Contacts in one role group, the same grouping as the Contacts page (contact_role()). */
function roleQuery(role: Role, select = SELECT) {
  return db().from("crm_contacts").select(select)
    .or(`contact_type.ilike.${role},and(contact_type.is.null,module.ilike.${role}),and(contact_type.eq.,module.ilike.${role})`);
}

const defaultsCache = new Map<Role, { at: number; defaults: Defaults }>();
export async function loadDefaults(role: Role, fresh = false): Promise<Defaults> {
  const hit = defaultsCache.get(role);
  if (!fresh && hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.defaults;
  const rows = await readAllRows<FillRow>((from, to) => roleQuery(role, "id, overrides, profile").order("id", { ascending: true }).range(from, to), { context: `loadDefaults(${role})` });
  const defaults = computeDefaults(rows, role);
  defaultsCache.set(role, { at: Date.now(), defaults });
  return defaults;
}

async function industryLabels(): Promise<string[]> {
  return offered(await loadVocabulary("industry")).map((o) => o.label);
}

export type RunOpts = { role: Role; step: Step; afterId?: string | null; guessFields?: string[] };
export type Plan = { items: FillItem[]; scanned: number; withWork: number; nextCursor: string | null; done: boolean; aiError?: string };

/** Cheap per-row work (steps 1 and 3) for one row. */
function cheapItems(r: FillRow, o: RunOpts, defaults: Defaults): FillItem[] {
  if (o.step === "contact") return contactItems(r, o.role);
  if (o.step === "guess") return guessItems(r, o.role, defaults, o.guessFields ?? defaultGuessFields(o.role));
  return [];
}

/**
 * Walk the group by keyset cursor collecting work. For the website step this only
 * finds candidates (rows with a site and a field to fill); reading sites is done by
 * readCandidates so a preview never fetches thousands of sites.
 */
export async function scan(o: RunOpts, wanted = Number.POSITIVE_INFINITY): Promise<Plan & { candidates: FillRow[] }> {
  const defaults = o.step === "guess" ? await loadDefaults(o.role) : {};
  const items: FillItem[] = [];
  const candidates: FillRow[] = [];
  let scanned = 0, withWork = 0;
  let cursor: string | null = o.afterId ?? null;
  for (let page = 0; page < 200; page++) {
    const fetchPage = () => {
      let q = roleQuery(o.role);
      if (cursor) q = q.gt("id", cursor);
      return q.order("id", { ascending: true }).limit(PAGE);
    };
    let { data, error } = await fetchPage();
    if (error?.code === "57014") { await new Promise((r) => setTimeout(r, 750)); ({ data, error } = await fetchPage()); }
    if (reportDbError(`contacts fill scan(${o.role},${o.step})`, error)) return { items, candidates, scanned, withWork, nextCursor: cursor, done: false };
    const rows = (data ?? []) as FillRow[];
    for (const r of rows) {
      scanned++;
      cursor = r.id;
      if (o.step === "website") {
        if (websiteTargets(r, o.role).length === 0) continue;
        candidates.push(r);
        withWork++;
      } else {
        const got = cheapItems(r, o, defaults);
        if (got.length === 0) continue;
        items.push(...got);
        withWork++;
      }
      if (withWork >= wanted) return { items, candidates, scanned, withWork, nextCursor: cursor, done: false };
    }
    if (rows.length < PAGE) return { items, candidates, scanned, withWork, nextCursor: null, done: true };
  }
  return { items, candidates, scanned, withWork, nextCursor: cursor, done: false };
}

/** Read the sites of some candidates, a few at a time. Stops at the first AI outage. */
async function readCandidates(role: Role, rows: FillRow[], useAi: boolean): Promise<{ items: FillItem[]; aiError?: string; unreadable: number }> {
  const labels = useAi ? await industryLabels() : [];
  const items: FillItem[] = [];
  let aiError: string | undefined;
  let unreadable = 0, cur = 0;
  async function worker() {
    while (cur < rows.length && !aiError) {
      const r = rows[cur++];
      const host = siteFor(r);
      const site = host ? await fetchSite(host) : null;
      if (!site) { unreadable++; continue; }
      let reading: SiteReading | null = null;
      const needsAi = websiteTargets(r, role).some((t) => t !== "linkedin") && site.text.length >= 200;
      if (useAi && needsAi) {
        try { reading = await readSite(role, r, site, labels); } catch (e) { aiError = e instanceof Error ? e.message : "AI unavailable."; break; }
      }
      items.push(...websiteItems(r, role, site, reading));
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, () => worker()));
  return { items, aiError, unreadable };
}

/** Counts per field, for the preview readout. Pure. */
export function countByField(items: FillItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) out[i.field] = (out[i.field] ?? 0) + 1;
  return out;
}

export type Preview = {
  contacts: number; scanned: number; byField: Record<string, number>;
  sample: FillItem[]; sampled?: number; unreadable?: number; aiError?: string;
  defaults?: Defaults;
};

/** Preview a step without writing. The website step reads a small sample of sites. */
export async function previewFill(o: RunOpts, sampleSites = 8): Promise<Preview> {
  if (o.step !== "website") {
    const p = await scan(o);
    return {
      contacts: p.withWork, scanned: p.scanned, byField: countByField(p.items), sample: p.items.slice(0, 40),
      defaults: o.step === "guess" ? await loadDefaults(o.role) : undefined,
    };
  }
  const p = await scan(o);
  const byField: Record<string, number> = {};
  for (const r of p.candidates) for (const t of websiteTargets(r, o.role)) byField[t] = (byField[t] ?? 0) + 1;
  const read = await readCandidates(o.role, p.candidates.slice(0, sampleSites), true);
  return { contacts: p.withWork, scanned: p.scanned, byField, sample: read.items, sampled: Math.min(sampleSites, p.candidates.length), unreadable: read.unreadable, aiError: read.aiError };
}

/** Write one contact's items. Re-reads the contact first: the plan is a snapshot. */
async function writeContact(o: RunOpts, id: string, planned: FillItem[], defaults: Defaults): Promise<{ written: FillItem[]; error: boolean }> {
  const { data: fresh, error } = await db().from("crm_contacts").select(SELECT).eq("id", id).maybeSingle();
  if (error || !fresh) return { written: [], error: true };
  const r = fresh as FillRow;
  // Recompute against the fresh row, keeping only what the plan intended.
  const still = (o.step === "website"
    ? planned.filter((i) => websiteTargets(r, o.role).includes(i.field))
    : cheapItems(r, o, defaults).filter((i) => planned.some((p) => p.field === i.field)));
  if (still.length === 0) return { written: [], error: false };

  const set: Record<string, unknown> = {};
  const keys: string[] = asList(r.overrides?.[`_cfill_${o.step}`]);
  const addKey = (k: string) => { if (!keys.includes(k)) keys.push(k); };
  const written: FillItem[] = [];
  for (const i of still) {
    if (i.key === "website") {
      // The column is written only while still empty, so a staff edit made meanwhile wins.
      const { data: upd, error: e2 } = await db().from("crm_contacts").update({ website: i.values[0] }).eq("id", id).is("website", null).select("id");
      if (e2 || !upd?.length) continue;
      set[i.sourceKey] = i.tag; addKey(i.sourceKey);
    } else if (i.key === "country") {
      set.country = i.values[0]; set[i.sourceKey] = i.tag; addKey("country"); addKey(i.sourceKey);
    } else {
      if (i.previous) {
        // One saved previous value per contact. If an earlier run already parked one,
        // replacing again would leave undo nothing to restore, so skip the upgrade.
        if (r.overrides?._industry_prev != null) continue;
        set._industry_prev = i.previous.values; set._industry_prev_source = i.previous.tag;
        addKey("_industry_prev"); addKey("_industry_prev_source");
      }
      set[i.key] = i.values; set[i.sourceKey] = i.tag; addKey(i.key); addKey(i.sourceKey);
    }
    written.push(i);
  }
  if (written.length === 0) return { written, error: false };
  set[`_cfill_${o.step}`] = keys;
  const merged = await mergeOverrides(id, { set }, `contacts fill apply(${o.role},${o.step})`);
  return merged === null ? { written: [], error: true } : { written, error: false };
}

export type ApplyResult = {
  scanned: number; contacts: number; fields: number; byField: Record<string, number>;
  errors: number; unreadable?: number; nextCursor: string | null; done: boolean; aiError?: string;
};

/** Contacts per apply call: the website step reads sites, so it takes far fewer. */
export const PER_RUN: Record<Step, number> = { contact: 300, website: 18, guess: 300 };

/** Apply one capped slice of a step, then report where to continue. */
export async function applyFill(o: RunOpts): Promise<ApplyResult> {
  const defaults = o.step === "guess" ? await loadDefaults(o.role) : {};
  const plan = await scan(o, PER_RUN[o.step]);
  let items = plan.items;
  let unreadable: number | undefined;
  let aiError: string | undefined;
  if (o.step === "website") {
    const read = await readCandidates(o.role, plan.candidates, true);
    items = read.items; unreadable = read.unreadable; aiError = read.aiError;
    // An AI outage mid-slice: keep what was read, but don't move the cursor past rows
    // the AI never saw, so the next run picks them up.
    if (aiError) return { scanned: plan.scanned, contacts: 0, fields: 0, byField: {}, errors: 0, unreadable, nextCursor: o.afterId ?? null, done: false, aiError };
  }
  const byContact = new Map<string, FillItem[]>();
  for (const i of items) byContact.set(i.contactId, [...(byContact.get(i.contactId) ?? []), i]);
  const todo = [...byContact.keys()];
  let contacts = 0, fields = 0, errors = 0, cur = 0;
  const byField: Record<string, number> = {};
  const industryTouched: string[] = [];
  async function worker() {
    while (cur < todo.length) {
      const id = todo[cur++];
      const res = await writeContact(o, id, byContact.get(id)!, defaults);
      if (res.error) { errors++; continue; }
      if (res.written.length === 0) continue;
      contacts++; fields += res.written.length;
      for (const w of res.written) {
        byField[w.field] = (byField[w.field] ?? 0) + 1;
        if (w.field === "industry") industryTouched.push(id);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, todo.length) }, () => worker()));
  // Investor industries feed /fit, so publish them now.
  if (o.role === "investor" && industryTouched.length) await reindexContacts(industryTouched).catch(() => 0);
  return { scanned: plan.scanned, contacts, fields, byField, errors, unreadable, nextCursor: plan.nextCursor, done: plan.done };
}

/** Remove everything one step wrote for a role, restoring a replaced industry. */
export async function undoFill(role: Role, step: Step): Promise<number> {
  const marker = `_cfill_${step}`;
  const rows = await readAllRows<{ id: string; website: string | null; overrides: Record<string, unknown> | null }>((from, to) =>
    roleQuery(role, "id, website, overrides").not(`overrides->${marker}`, "is", null).order("id", { ascending: true }).range(from, to), { context: "contacts fill undo: read" });
  let removed = 0;
  const industryTouched: string[] = [];
  for (const part of chunk(rows, 6)) {
    const res = await Promise.all(part.map(async (r) => {
      const keys = asList(r.overrides?.[marker]);
      const set: Record<string, unknown> = {};
      const remove = [...keys, marker];
      if (keys.includes("_website_source") && r.overrides?._website_source === "derived:email" && r.website) {
        await db().from("crm_contacts").update({ website: null }).eq("id", r.id).eq("website", r.website);
      }
      if (keys.includes("Industries") && keys.includes("_industry_prev")) {
        const prev = asList(r.overrides?._industry_prev);
        const prevTag = r.overrides?._industry_prev_source;
        if (prev.length) { set.Industries = prev; if (typeof prevTag === "string" && prevTag) set._industry_source = prevTag; }
        const keep = new Set(Object.keys(set));
        return mergeOverrides(r.id, { set, remove: remove.filter((k) => !keep.has(k)) }, "contacts fill undo");
      }
      return mergeOverrides(r.id, { remove }, "contacts fill undo");
    }));
    res.forEach((m, i) => {
      if (m === null) return;
      removed++;
      if (asList(part[i].overrides?.[marker]).includes("Industries")) industryTouched.push(part[i].id);
    });
  }
  if (role === "investor" && industryTouched.length) await reindexContacts(industryTouched).catch(() => 0);
  return removed;
}
