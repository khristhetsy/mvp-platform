/**
 * Column mapping for directory imports. Pure, so the wizard (browser) and the
 * upload route (server) run the exact same code.
 *
 * Flow: a sheet becomes headers + rows; every header is matched to the
 * directory's existing fields (or left for the admin to answer, with the best
 * fits suggested and a reason); the confirmed mapping is applied to build the
 * same CleanRow shape the CSV pipeline produces, with the same normalizing and
 * dedupe. A column can feed several fields, and several columns can feed one.
 */
import {
  type CleanResult,
  type CleanRow,
  mapCapitalTypes,
  mapFundingStages,
  mapInvestorTypes,
  mergeInto,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  num,
  tidy,
  yesNo,
} from "@/lib/investor-directory/clean";

export type FieldKey =
  | "firm" | "contact_name" | "title" | "email" | "phone" | "website"
  | "location" | "city" | "state" | "country"
  | "investor_types" | "funding_stages" | "capital_types" | "industries"
  | "fund_name" | "fund_size" | "avg_investment" | "strategy" | "investing_now"
  | "notes" | "source_url";

export const FIELDS: { key: FieldKey; label: string; hint: string }[] = [
  { key: "firm", label: "Firm", hint: "Required. The investor or company name." },
  { key: "contact_name", label: "Contact name", hint: "A person at the firm." },
  { key: "title", label: "Title", hint: "Job title or role." },
  { key: "email", label: "Email", hint: "One email per record. Format checked only." },
  { key: "phone", label: "Phone", hint: "US numbers are formatted." },
  { key: "website", label: "Website", hint: "Firm website." },
  { key: "location", label: "Location (city, state, country)", hint: "One column split into city, state and country." },
  { key: "city", label: "City", hint: "" },
  { key: "state", label: "State", hint: "Stored as the two letter code when it is a US state." },
  { key: "country", label: "Country", hint: "" },
  { key: "investor_types", label: "Investor type", hint: "Matched to the platform list." },
  { key: "funding_stages", label: "Funding stage", hint: "Matched to the platform list." },
  { key: "capital_types", label: "Capital type", hint: "Equity or debt." },
  { key: "industries", label: "Industries", hint: "Kept as written, split on commas and semicolons." },
  { key: "fund_name", label: "Fund name", hint: "" },
  { key: "fund_size", label: "Fund size", hint: "A number." },
  { key: "avg_investment", label: "Average investment", hint: "A number." },
  { key: "strategy", label: "Strategy", hint: "Free text, such as lead or follow." },
  { key: "investing_now", label: "Investing now", hint: "Yes or no." },
  { key: "notes", label: "Notes", hint: "Kept with the column name in front, so nothing is lost." },
  { key: "source_url", label: "Source link", hint: "Where the row came from." },
];

const LABEL = new Map(FIELDS.map((f) => [f.key, f.label]));
export const fieldLabel = (k: FieldKey): string => LABEL.get(k) ?? k;

/** Column index (as a string key) to the fields it feeds. An empty list means skip. */
export type Mapping = Record<string, FieldKey[]>;
/** Column index to raw value to the platform values chosen for it. */
export type ValueMap = Record<string, Record<string, string[]>>;

const norm = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ALIASES: Record<FieldKey, string[]> = {
  firm: ["investor name", "firm", "firm name", "company", "company name", "organization", "organisation", "investor", "institution", "investor firm", "fund manager"],
  contact_name: ["contact name", "contact", "name", "full name", "person", "partner", "principal", "investor contact"],
  title: ["title", "job title", "job title role", "role", "position", "job position"],
  email: ["email", "e mail", "email 1", "public email", "email address", "contact email", "work email"],
  phone: ["phone", "telephone", "tel", "phone number", "mobile", "cell"],
  website: ["website", "web site", "site", "homepage", "firm website", "company website", "url"],
  location: ["location", "hq", "hq location", "headquarters", "geography", "address"],
  city: ["city", "town"],
  state: ["state", "province", "state province"],
  country: ["country"],
  investor_types: ["investor type", "type", "investor category", "firm type", "investor types"],
  funding_stages: ["funding stage", "investment stage", "stage", "stages", "funding stages", "investment stages"],
  capital_types: ["capital type", "capital types"],
  industries: ["industry", "industries", "industry sector", "sector", "sectors", "investment focus", "focus", "vertical", "verticals"],
  fund_name: ["fund name", "fund"],
  fund_size: ["fund size", "aum", "fund size usd"],
  avg_investment: ["avg investment", "average investment", "avg check", "average check size", "check size", "typical check", "avg investment size"],
  strategy: ["strategy", "investment strategy", "lead follow", "lead or follow"],
  investing_now: ["investing now", "actively investing", "active"],
  notes: ["notes", "note", "comments", "comment", "contact attribution note", "verification status", "past investments", "investment size", "description", "bio", "about"],
  source_url: ["source url", "source link", "reference url", "link", "source"],
};

export type Suggestion = {
  /** Fields chosen automatically. Empty when the admin must answer. */
  fields: FieldKey[];
  /** True when the header matched on its own and needs no answer. */
  matched: boolean;
  /** Why: shown under the column. */
  reason: string;
  /** Best fits to offer when not matched, most likely first. */
  options: { field: FieldKey | "skip"; reason: string }[];
};

const EMAIL_LIKE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
const URL_LIKE = /^(https?:\/\/|www\.)\S+$/i;
const PHONE_LIKE = /^[+()\d][\d\s().+-]{6,}$/;
const MONEY_LIKE = /^[$€£]?\s?\d[\d,]*(\.\d+)?\s?[kmb]?$/i;

function share(values: string[], test: (v: string) => boolean): boolean {
  if (!values.length) return false;
  return values.filter(test).length / values.length >= 0.6;
}

/** Match one header against the existing fields. `samples` are non-empty example values. */
export function suggest(header: string, samples: string[]): Suggestion {
  const h = norm(header);
  if (/^e ?mail [2-9]$/.test(h)) {
    return {
      fields: [], matched: true,
      reason: `"${header}" is an extra email column. A record keeps one email, so it is skipped.`,
      options: [{ field: "skip", reason: "Extra emails are not stored." }],
    };
  }
  // A bare "source" column is a link when it holds links, otherwise a note.
  if (h === "source") {
    const link = share(samples, (v) => URL_LIKE.test(v));
    const f: FieldKey = link ? "source_url" : "notes";
    return {
      fields: [f], matched: true,
      reason: link ? `"${header}" holds web addresses, so it feeds Source link.` : `"${header}" holds text, so it is kept in Notes.`,
      options: [],
    };
  }
  const hits = (Object.keys(ALIASES) as FieldKey[]).filter((k) => ALIASES[k].includes(h));
  if (hits.length) {
    // "fund" alone and "name" are weak: fall through when both firm and a weaker field match.
    const f = hits.includes("firm") ? "firm" : hits[0];
    return { fields: [f], matched: true, reason: `"${header}" is a common name for ${fieldLabel(f)}.`, options: [] };
  }

  const options: Suggestion["options"] = [];
  const add = (field: FieldKey, reason: string) => { if (!options.some((o) => o.field === field)) options.push({ field, reason }); };
  if (share(samples, (v) => EMAIL_LIKE.test(v))) add("email", "The values look like email addresses.");
  if (share(samples, (v) => URL_LIKE.test(v))) { add("website", "The values look like web addresses."); add("source_url", "A web address can also be where the row came from."); }
  if (share(samples, (v) => PHONE_LIKE.test(v) && !MONEY_LIKE.test(v))) add("phone", "The values look like phone numbers.");
  if (share(samples, (v) => MONEY_LIKE.test(v))) { add("fund_size", "The values are numbers."); add("avg_investment", "The values are numbers."); }
  const words = h.split(" ");
  if (words.some((w) => ["industry", "sector", "focus", "vertical"].includes(w))) add("industries", `"${header}" reads like an industry list.`);
  if (words.some((w) => ["stage", "round"].includes(w))) add("funding_stages", `"${header}" reads like a funding stage.`);
  if (words.some((w) => ["type", "category"].includes(w))) add("investor_types", `"${header}" reads like an investor type.`);
  if (words.some((w) => ["city", "state", "country", "location", "region"].includes(w))) add("location", `"${header}" reads like a place.`);
  if (words.some((w) => ["size", "check", "ticket"].includes(w))) add("avg_investment", `"${header}" reads like an amount.`);
  add("notes", "Keeps the column as a note, with its name in front, so nothing is lost.");
  options.push({ field: "skip", reason: "Leave this column out of the import." });
  const top = options[0];
  return {
    fields: [], matched: false,
    reason: top.field === "notes" || top.field === "skip" ? `No existing field is a clear fit for "${header}".` : `Closest fit for "${header}": ${fieldLabel(top.field as FieldKey)}. ${top.reason}`,
    options,
  };
}

/** Example values per column: the first few non-empty cells. */
export function sampleColumns(headers: string[], rows: string[][], n = 8): string[][] {
  return headers.map((_, i) => {
    const out: string[] = [];
    for (const r of rows) {
      const v = tidy(r[i]);
      if (v) out.push(v);
      if (out.length >= n) break;
    }
    return out;
  });
}

/** First pass over every column: the automatic matches plus what still needs an answer. */
export function autoMatch(headers: string[], rows: string[][]): { mapping: Mapping; suggestions: Suggestion[]; needsAnswer: number[] } {
  const samples = sampleColumns(headers, rows);
  const suggestions = headers.map((h, i) => suggest(h, samples[i]));
  const mapping: Mapping = {};
  const needsAnswer: number[] = [];
  suggestions.forEach((s, i) => {
    if (s.matched) mapping[String(i)] = s.fields;
    else needsAnswer.push(i);
  });
  // Two columns both claiming Firm: the first stays, the second is asked.
  const firmCols = Object.entries(mapping).filter(([, f]) => f.includes("firm")).map(([i]) => Number(i));
  for (const extra of firmCols.slice(1)) { delete mapping[String(extra)]; needsAnswer.push(extra); }
  needsAnswer.sort((a, b) => a - b);
  return { mapping, suggestions, needsAnswer };
}

/** Distinct raw values of a column, most common first, for the value-choice step. */
export function distinctValues(rows: string[][], col: number, split = true): string[] {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const cell = tidy(r[col]);
    if (!cell) continue;
    for (const v of split ? splitList(cell) : [cell]) seen.set(v, (seen.get(v) ?? 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

/** Distinct raw values of a column with how many rows carry each, most common first. */
export function valueCounts(rows: string[][], col: number): { value: string; count: number }[] {
  const seen = new Map<string, number>();
  for (const r of rows) for (const v of splitList(tidy(r[col]))) seen.set(v, (seen.get(v) ?? 0) + 1);
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}

/** How many rows have something in this column. */
export function filledCount(rows: string[][], col: number): number {
  return rows.filter((r) => tidy(r[col])).length;
}

export const splitList = (v: string | null | undefined): string[] =>
  (v ?? "").split(/[;|,]/).map((x) => x.trim()).filter(Boolean);

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};
const STATE_CODES = new Set(Object.values(STATES));
const US_NAMES = new Set(["usa", "us", "u.s.", "u.s.a.", "united states", "united states of america"]);

/** "Boston, MA" / "California, USA" / "TX, USA" / "Massachusetts" into city, state and country. */
export function parseLocation(v: string | null | undefined): { city: string | null; state: string | null; country: string | null } {
  const parts = splitList(v).map((p) => p.replace(/\s+/g, " "));
  let country: string | null = null;
  let state: string | null = null;
  let city: string | null = null;
  const asState = (p: string): string | null => {
    const lo = p.toLowerCase();
    if (STATES[lo]) return STATES[lo];
    const up = p.toUpperCase();
    return STATE_CODES.has(up) ? up : null;
  };
  if (parts.length && US_NAMES.has(parts[parts.length - 1].toLowerCase())) { country = "US"; parts.pop(); }
  if (parts.length) {
    const last = asState(parts[parts.length - 1]);
    if (last) { state = last; if (!country) country = "US"; parts.pop(); }
  }
  if (parts.length) {
    if (!state && !country && parts.length === 1) city = normalizeName(parts[0]);
    else city = normalizeName(parts.join(", "));
  }
  return { city, state, country };
}

/** The directory stores the United States as "US"; other countries are kept as written. */
function normalizeCountry(v: string): string | null {
  const t = tidy(v);
  if (!t) return null;
  return US_NAMES.has(t.toLowerCase()) ? "US" : normalizeName(t);
}

const VOCAB_FIELDS = new Set<FieldKey>(["investor_types", "funding_stages", "capital_types"]);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** One raw label onto the platform's option slugs, using the existing public-label mappers. */
export function mapLabel(field: FieldKey, raw: string): string[] {
  if (field === "investor_types") return mapInvestorTypes(null, raw);
  if (field === "funding_stages") return mapFundingStages(raw, null);
  if (field === "capital_types") return mapCapitalTypes(raw, null);
  return [];
}

export type ApplyResult = CleanResult & { missingFirm: boolean };

/** Build clean rows from a sheet and a confirmed mapping. */
export function applyMapping(headers: string[], rows: string[][], mapping: Mapping, valueMap: ValueMap = {}): ApplyResult {
  const cols: { i: number; fields: FieldKey[] }[] = [];
  for (const [k, fields] of Object.entries(mapping)) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && i < headers.length && fields.length) cols.push({ i, fields });
  }
  cols.sort((a, b) => a.i - b.i);
  const mapsFirm = cols.some((c) => c.fields.includes("firm") || c.fields.includes("fund_name"));
  if (!mapsFirm) return { rows: [], rowCount: rows.length, merged: 0, invalidEmails: 0, skipped: rows.length, missingFirm: true };

  let invalidEmails = 0;
  let skipped = 0;
  let merged = 0;
  const byKey = new Map<string, CleanRow>();

  for (const r of rows) {
    if (!r.some((c) => tidy(c))) continue; // blank line, not a skipped record
    const text: Partial<Record<FieldKey, string>> = {};
    const lists: Record<"investor_types" | "funding_stages" | "capital_types" | "industries", Set<string>> = {
      investor_types: new Set(), funding_stages: new Set(), capital_types: new Set(), industries: new Set(),
    };
    const notes: string[] = [];
    let email: string | null = null;
    let sawInvalid = false;
    let loc = { city: null as string | null, state: null as string | null, country: null as string | null };

    for (const { i, fields } of cols) {
      const cell = tidy(r[i]);
      if (!cell) continue;
      for (const f of fields) {
        if (f === "notes") { notes.push(`${headers[i].trim()}: ${cell}`); continue; }
        if (f === "email") {
          if (email) continue;
          const e = normalizeEmail(cell);
          if (e.email) email = e.email; else if (e.invalid) sawInvalid = true;
          continue;
        }
        if (f === "location") {
          const p = parseLocation(cell);
          loc = { city: loc.city ?? p.city, state: loc.state ?? p.state, country: loc.country ?? p.country };
          continue;
        }
        if (f === "industries") { for (const v of splitList(cell)) lists.industries.add(valueMap[i]?.[v]?.[0] ?? v); continue; }
        if (VOCAB_FIELDS.has(f)) {
          const target = lists[f as "investor_types" | "funding_stages" | "capital_types"];
          let kept = 0;
          for (const v of splitList(cell)) {
            const chosen = valueMap[i]?.[v];
            const slugs = chosen ?? (SLUG.test(v) ? [v] : mapLabel(f, v));
            for (const s of slugs) { target.add(s); kept++; }
          }
          if (!kept) notes.push(`${headers[i].trim()}: ${cell}`); // nothing matched: keep the words for the verifier
          continue;
        }
        if (text[f] === undefined) text[f] = cell;
      }
    }
    if (sawInvalid && !email) invalidEmails++;

    const firm = normalizeName(text.firm) ?? normalizeName(text.fund_name);
    if (!firm) { skipped++; continue; }
    const state = text.state ? (STATES[text.state.toLowerCase()] ?? text.state.toUpperCase()) : loc.state;
    const row: CleanRow = {
      firm,
      contact_name: normalizeName(text.contact_name),
      title: tidy(text.title),
      email,
      phone: normalizePhone(text.phone),
      website: tidy(text.website),
      city: text.city ? normalizeName(text.city) : loc.city,
      state,
      country: text.country ? normalizeCountry(text.country) : loc.country,
      investor_types: [...lists.investor_types],
      funding_stages: [...lists.funding_stages],
      capital_types: [...lists.capital_types],
      industries: [...lists.industries],
      fund_name: tidy(text.fund_name),
      fund_size: num(text.fund_size),
      avg_investment: num(text.avg_investment),
      strategy: tidy(text.strategy),
      investing_now: yesNo(tidy(text.investing_now)),
      notes: notes.length ? notes.join(" | ") : null,
      source_url: tidy(text.source_url),
    };
    const key = email ?? `${firm.toLowerCase()}|${(row.contact_name ?? "").toLowerCase()}`;
    const prev = byKey.get(key);
    if (prev) { merged++; mergeInto(prev, row); continue; }
    byKey.set(key, row);
  }
  return {
    rows: [...byKey.values()],
    rowCount: rows.filter((r) => r.some((c) => tidy(c))).length,
    merged, invalidEmails, skipped, missingFirm: false,
  };
}

/** What the admin sees before importing: per field, how many rows will carry a value. */
export function fieldCoverage(result: CleanResult): { field: FieldKey; filled: number }[] {
  const keys: FieldKey[] = ["firm", "contact_name", "title", "email", "phone", "website", "city", "state", "country",
    "investor_types", "funding_stages", "capital_types", "industries", "fund_name", "fund_size", "avg_investment", "strategy", "notes", "source_url"];
  return keys.map((field) => ({
    field,
    filled: result.rows.filter((r) => {
      const v = (r as Record<string, unknown>)[field];
      return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "";
    }).length,
  }));
}
