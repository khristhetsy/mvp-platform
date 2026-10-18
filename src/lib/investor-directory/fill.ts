import { suggestIndustries, type SignalSource } from "@/lib/investor-directory/industries";

/**
 * Guesses for the empty fields of one record, from what the record already holds: the firm name, the
 * website domain, the email domain, the profile text and, when the admin asked for it, the home page text.
 * Pure rules, no scores. A guess is Strong only when two different sources agree. Nothing here is saved
 * and nothing marks a record verified.
 */
export type FillField = "website" | "investor_types" | "capital_types" | "industries";
export type FillGuess = {
  values: string[];
  level: "strong" | "possible";
  signals: { value: string; source: SignalSource | "type"; word: string }[];
};
export type Fill = Partial<Record<FillField, FillGuess>>;

export type FillInput = {
  firm: string;
  website?: string | null;
  email?: string | null;
  profile?: string | null;
  siteText?: string | null;
  have: { investor_types: string[]; capital_types: string[]; industries: string[] };
};

export const FILL_FIELD_LABEL: Record<FillField, string> = {
  website: "Website", investor_types: "Investor type", capital_types: "Capital type", industries: "Industries",
};

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.fr", "hotmail.com", "outlook.com", "live.com", "msn.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "comcast.net", "att.net", "verizon.net", "sbcglobal.net",
]);

/** The company domain of an email address, or null for free mail and anything that is not an address. */
export function companyEmailDomain(email: string | null | undefined): string | null {
  const m = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec((email ?? "").trim().toLowerCase());
  if (!m) return null;
  return FREE_MAIL.has(m[1]) ? null : m[1];
}

const TYPE_RULES: [RegExp, string][] = [
  [/\b(ventures?|venture capital|vc)\b/, "venture-capital"],
  [/\bangels?\b/, "angel-investor"],
  [/\b(family office|family offices|family capital|family fund)\b/, "family-office"],
  [/\b(private equity|buyouts?|equity partners)\b/, "private-equity"],
  [/\bhedge\b/, "hedge-fund"],
  [/\b(lending|lenders?|loans?|credit|mortgage|debt)\b/, "lender"],
];
const EQUITY_TYPES = new Set(["venture-capital", "angel-investor", "family-office", "private-equity", "hedge-fund"]);

const labelWords = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stem = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const rootLabel = (domain: string) => domain.toLowerCase().replace(/^www\./, "").split(".")[0];
const tld = (domain: string) => domain.toLowerCase().replace(/^www\./, "").split(".").slice(1).join(".");
const hostOf = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\/?#]/)[0];

function rank(list: { value: string; source: string }[]): { values: string[]; level: "strong" | "possible" } | null {
  const by = new Map<string, Set<string>>();
  for (const s of list) { if (!by.has(s.value)) by.set(s.value, new Set()); by.get(s.value)!.add(s.source); }
  const ranked = [...by.entries()].sort((a, b) => b[1].size - a[1].size);
  if (!ranked.length) return null;
  const top = ranked[0][1].size;
  const keep = ranked.filter(([, s]) => s.size === top).slice(0, 3).map(([v]) => v);
  return { values: keep, level: top >= 2 ? "strong" : "possible" };
}

export function suggestFill(input: FillInput): Fill {
  const out: Fill = {};
  const website = hostOf(input.website);
  const emailDomain = companyEmailDomain(input.email);

  // Website, only when empty: the company email domain, backed by the firm name when they agree.
  if (!website && emailDomain) {
    const root = stem(rootLabel(emailDomain));
    const firm = stem(input.firm);
    const core = firm.replace(/(ventures?|capital|partners?|group|fund|holdings?|llc|inc)+$/, "");
    const agrees = root.length >= 3 && (firm.includes(root) || (core.length >= 3 && root.includes(core)));
    out.website = {
      values: [`https://${emailDomain}`],
      level: agrees ? "strong" : "possible",
      signals: [{ value: emailDomain, source: "email", word: emailDomain }, ...(agrees ? [{ value: emailDomain, source: "name" as const, word: input.firm }] : [])],
    };
  }

  // Investor type, only when empty.
  let types = input.have.investor_types;
  if (!types.length) {
    const found: { value: string; source: string; word: string }[] = [];
    const sources: [string, string | null | undefined][] = [
      ["name", labelWords(input.firm)],
      ["domain", website ? `${rootLabel(website)} ${tld(website).split(".").join(" ")}` : ""],
      ["email", emailDomain ? `${rootLabel(emailDomain)} ${tld(emailDomain).split(".").join(" ")}` : ""],
      ["profile", input.profile ? labelWords(input.profile) : ""],
      ["website", input.siteText ? labelWords(input.siteText) : ""],
    ];
    for (const [source, text] of sources) {
      if (!text) continue;
      for (const [re, slug] of TYPE_RULES) { const m = re.exec(text); if (m) found.push({ value: slug, source, word: m[0] }); }
    }
    const r = rank(found);
    if (r) {
      out.investor_types = { values: r.values, level: r.level, signals: found.filter((f) => r.values.includes(f.value)).map((f) => ({ value: f.value, source: f.source as SignalSource, word: f.word })) };
      types = r.values;
    }
  }

  // Capital type, only when empty. Follows the investor type, on the record or just guessed.
  if (!input.have.capital_types.length && types.length) {
    const eq = types.some((t) => EQUITY_TYPES.has(t));
    const debt = types.includes("lender");
    const values = [...(eq ? ["equity-capital"] : []), ...(debt ? ["debt-capital"] : [])];
    if (values.length) {
      const fromRecord = input.have.investor_types.length > 0;
      out.capital_types = {
        values,
        level: fromRecord || out.investor_types?.level === "strong" ? "strong" : "possible",
        signals: types.filter((t) => EQUITY_TYPES.has(t) || t === "lender").map((t) => ({ value: t, source: "type" as const, word: t })),
      };
    }
  }

  // Industries, only when empty.
  if (!input.have.industries.length) {
    const s = suggestIndustries({ firm: input.firm, website: input.website, emailDomain, profile: input.profile, siteText: input.siteText });
    if (s.slugs.length && s.level !== "none") out.industries = { values: s.slugs, level: s.level, signals: s.signals.map((x) => ({ value: x.slug, source: x.source, word: x.word })) };
  }
  return out;
}

/** The fields of a record that are empty and so can be guessed. */
export function missingFields(r: { website: string | null; investor_types: string[]; capital_types: string[]; industries: string[] }): FillField[] {
  const m: FillField[] = [];
  if (r.industries.length === 0) m.push("industries");
  if (r.investor_types.length === 0) m.push("investor_types");
  if (r.capital_types.length === 0) m.push("capital_types");
  if (!r.website) m.push("website");
  return m;
}
