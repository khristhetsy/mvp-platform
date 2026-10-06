/**
 * LinkedIn contact profile fill: what can be proposed for a contact, where each value
 * lands when accepted, and how the research file and the Drive exports turn into
 * proposals. Pure, so it is unit tested and safe on the client.
 *
 * Three labels, as approved in the mockup:
 *   linkedin  from the LinkedIn export itself
 *   found     from a published source, named in source_url
 *   guess     worked out from a source, with the reason in basis
 *
 * Nothing proposed here is read by matching until a person accepts it.
 * Guessed emails are never proposed (an address is either published or left out).
 */

import { companyKey } from "@/lib/contacts/linkedin-import";

export type FillLabel = "linkedin" | "found" | "guess";

export type FillField =
  | "bio"
  | "company_summary"
  | "website"
  | "investor_type"
  | "industries"
  | "funding_stages"
  | "check_size"
  | "geography"
  | "email"
  | "phone";

export type FieldSpec = {
  field: FillField;
  label: string;
  /** Multi value fields store a list of vocabulary labels. */
  multi: boolean;
  /** Vocabulary list the values come from, when the field is a selection. */
  vocabulary?: "investor_type" | "industry" | "funding_stage" | "money_band" | "geography";
  /**
   * Where an accepted value is saved through the contact editor (saveField): a column
   * field name, or the profile label it is stored under. email and phone are special:
   * main slot when empty, otherwise the second email / second phone.
   */
  saveKey: string;
};

export const FIELD_SPECS: FieldSpec[] = [
  { field: "bio", label: "Bio", multi: false, saveKey: "Bio" },
  { field: "company_summary", label: "Company summary", multi: false, saveKey: "Investor business summary" },
  { field: "website", label: "Website", multi: false, saveKey: "website" },
  { field: "investor_type", label: "Investor type", multi: false, vocabulary: "investor_type", saveKey: "Investor profile" },
  { field: "industries", label: "Industry", multi: true, vocabulary: "industry", saveKey: "Industries" },
  { field: "funding_stages", label: "Funding stage", multi: true, vocabulary: "funding_stage", saveKey: "Funding stage" },
  { field: "check_size", label: "Typical check size", multi: false, vocabulary: "money_band", saveKey: "Investor investment size?" },
  { field: "geography", label: "Geography", multi: true, vocabulary: "geography", saveKey: "Geography" },
  { field: "email", label: "Email", multi: false, saveKey: "email" },
  { field: "phone", label: "Phone", multi: false, saveKey: "phone" },
];

export function fieldSpec(field: string): FieldSpec | undefined {
  return FIELD_SPECS.find((f) => f.field === field);
}

export type Suggestion = {
  field: FillField;
  value: string | string[];
  label: FillLabel;
  sourceUrl: string | null;
  basis: string | null;
  confidence: string | null;
};

/** slug or label → label, for one vocabulary list. */
export type Vocab = Map<string, string>;

const clean = (v: unknown): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/** Split "a, b | c; d" into distinct trimmed parts. Pure. */
export function splitList(v: unknown): string[] {
  const out: string[] = [];
  for (const p of clean(v).split(/[,;|]/)) {
    const t = p.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Map values onto a vocabulary by slug or label; unknown values are dropped, never invented. Pure. */
export function toLabels(values: string[], vocab: Vocab | undefined): string[] {
  if (!vocab) return values;
  const out: string[] = [];
  for (const v of values) {
    const hit = vocab.get(v.toLowerCase());
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

/**
 * "investor_type: firm bio says single family office | industries: lists real estate"
 * → { investor_type: "firm bio says…", industries: "lists real estate" }. Pure.
 */
export function parseGuessBasis(text: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of clean(text).split(" | ")) {
    const m = part.match(/^([a-z_]+)\s*:\s*(.+)$/i);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

/** First http(s) URL in a text, if any. Pure. */
export function firstUrl(text: unknown): string | null {
  const m = clean(text).match(/https?:\/\/[^\s,|)]+/i);
  return m ? m[0].replace(/[.;]+$/, "") : null;
}

/** Strip notes like "(firm office)" from a published phone and say whether it is an office line. Pure. */
export function readPublishedPhone(v: unknown): { phone: string; office: boolean } | null {
  const s = clean(v);
  if (!s) return null;
  const office = /office|main|firm|general|switchboard/i.test(s);
  const phone = s.replace(/\(.*?(office|main|firm|general|line|switchboard).*?\)/gi, "").trim();
  return /\d{3}.*\d{3}/.test(phone) ? { phone, office } : null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/**
 * One row of LinkedIn_Investor_Profiles_AI.csv → proposals for that contact.
 * Columns: Bio, Bio basis (published | title_only), Bio sources, Company summary,
 * Website, Investor type (guess), Industries (guess), Funding stages (guess),
 * Check size (guess), Geography (guess), Guess basis, Published email,
 * Published phone, Contact source, Confidence. Pure.
 */
export function suggestionsFromResearchRow(row: Record<string, string>, vocab: Partial<Record<NonNullable<FieldSpec["vocabulary"]>, Vocab>>): Suggestion[] {
  const out: Suggestion[] = [];
  const confidence = clean(row["Confidence"]) || null;
  const bio = clean(row["Bio"]);
  const bioSource = firstUrl(row["Bio sources"]);
  if (bio) {
    const published = clean(row["Bio basis"]).toLowerCase() === "published" && bioSource;
    out.push({
      field: "bio", value: bio,
      label: published ? "found" : "guess",
      sourceUrl: bioSource,
      basis: published ? "Written from the published source" : "Only the LinkedIn title was found; nothing published about this person",
      confidence,
    });
  }

  const website = clean(row["Website"]);
  if (website && /\./.test(website)) {
    out.push({ field: "website", value: website.startsWith("http") ? website : `https://${website}`, label: "found", sourceUrl: website.startsWith("http") ? website : `https://${website}`, basis: "Firm website", confidence });
  }

  const basis = parseGuessBasis(row["Guess basis"]);
  const guess = (field: FillField, column: string, key: string, list: NonNullable<FieldSpec["vocabulary"]>, multi: boolean) => {
    const labels = toLabels(splitList(row[column]), vocab[list]);
    if (!labels.length) return;
    out.push({ field, value: multi ? labels : labels[0], label: "guess", sourceUrl: null, basis: basis[key] ?? "From the firm's published description", confidence });
  };
  guess("investor_type", "Investor type (guess)", "investor_type", "investor_type", false);
  guess("industries", "Industries (guess)", "industries", "industry", true);
  guess("funding_stages", "Funding stages (guess)", "funding_stages", "funding_stage", true);
  guess("check_size", "Check size (guess)", "check_size", "money_band", false);
  guess("geography", "Geography (guess)", "geography", "geography", true);

  const contactSource = firstUrl(row["Contact source"]);
  const email = clean(row["Published email"]).toLowerCase();
  if (email && EMAIL_RE.test(email)) {
    out.push({ field: "email", value: email, label: "found", sourceUrl: contactSource, basis: contactSource ? "Published on the page linked" : "Published (source not recorded)", confidence });
  }
  const phone = readPublishedPhone(row["Published phone"]);
  if (phone) {
    out.push({ field: "phone", value: phone.phone, label: "found", sourceUrl: contactSource, basis: phone.office ? "Office line, published" : "Direct line, published", confidence });
  }
  return out;
}

/** Company summary from a research row, shared by everyone at the company. Pure. */
export function companySummaryFromRow(row: Record<string, string>): { company: string; summary: string; website: string | null; hqCity: string | null } | null {
  const company = clean(row["Company"]);
  const summary = clean(row["Company summary"]);
  // The research marks firms it could not confirm; those summaries describe a near miss
  // and would mislead, so they are left out.
  if (!company || !summary || /could not be confirmed|no investment firm named|could not confirm/i.test(summary)) return null;
  return { company, summary, website: clean(row["Website"]) || null, hqCity: clean(row["HQ city"]) || null };
}

/**
 * One row of LinkedIn_Connections_Found_Contacts.csv (Khris's own Drive exports) →
 * email and phone proposals labelled with the export they came from. Pure.
 */
export function suggestionsFromFoundRow(row: Record<string, string>): Suggestion[] {
  const out: Suggestion[] = [];
  const source = clean(row["Source"]) || "Your exports";
  const email = clean(row["Email"]).toLowerCase();
  if (email && EMAIL_RE.test(email)) out.push({ field: "email", value: email, label: "found", sourceUrl: null, basis: source, confidence: "high" });
  const phone = clean(row["Phone"]);
  if (phone && /\d{3}.*\d{3}/.test(phone)) out.push({ field: "phone", value: phone, label: "found", sourceUrl: null, basis: source, confidence: "high" });
  return out;
}

/** Normalised company key for shared summaries (same rule as the LinkedIn import). Pure. */
export function companyKeyOf(company: string): string {
  return companyKey(company) ?? company.toLowerCase().trim();
}
