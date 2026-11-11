// Wording limits shared by the server checks and the campaign form. No server imports here,
// so client components can use it.
export const MAX_VARIANTS = 5;
/** LinkedIn's invite note limit for free accounts. Kept at the lower limit on purpose. */
export const INVITE_NOTE_LIMIT = 200;
export const MESSAGE_LIMIT = 1900;
/** Pages of your LinkedIn connections read per day. Each page shows about 10 people. My proposal, not a LinkedIn number. */
export const READ_PAGES_PER_DAY = 3;
/** LinkedIn shows at most 100 pages (1,000 people) for one search of your connections. */
export const MAX_RESULT_PAGES = 100;

/** Most title words one campaign can keep. */
export const MAX_TITLES = 12;
/** Starting title words, filled in when you pick Founders or Investors. Edit freely. */
export const DEFAULT_TITLES = {
  founder: ["Founder", "Co-founder", "Cofounder", "CEO", "Owner"],
  investor: ["Investor", "Partner", "Angel", "Managing director", "Venture"],
} as const;

/** Minutes a count request waits for the extension before it counts as unanswered. */
export const MATCH_CHECK_MAX_MINUTES = 10;
/** Most values one filter can hold, for example 10 industries. */
export const MAX_FILTER_VALUES = 10;
/** The six filters that take several values. The search by name stays a single text. */
export const FACET_KEYS = ["industry", "locations", "currentCompany", "pastCompany", "school", "profileLanguage"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];
/**
 * Minutes since the extension last asked iCapOS for work before the form calls it not detected.
 * The extension asks once a minute, and one action may hold it up for at most 10 minutes (LEASE_GUARD_MS in the extension).
 */
export const EXTENSION_FRESH_MINUTES = 15;

/** One filter's values as a clean list. Accepts the old single text or a list. Trimmed, unique ignoring case, at most 10, each at most 80 characters. */
export function cleanValues(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const t = typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
    if (out.length >= MAX_FILTER_VALUES) break;
  }
  return out;
}

/** The filters LinkedIn itself uses to count people. Titles and sort do not change LinkedIn's total. Order of the values does not matter. */
export function matchKey(f: Record<string, unknown>): string {
  const facets = FACET_KEYS.map((k) => cleanValues(f[k]).map((x) => x.toLowerCase()).sort());
  const name = typeof f.name === "string" ? f.name.trim().toLowerCase() : "";
  return JSON.stringify([...facets, name]);
}
