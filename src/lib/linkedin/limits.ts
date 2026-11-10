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
/** The filters LinkedIn itself uses to count people. Titles and sort do not change LinkedIn's total. */
export function matchKey(f: Record<string, unknown>): string {
  const keys = ["industry", "locations", "currentCompany", "pastCompany", "school", "profileLanguage", "name"];
  return JSON.stringify(keys.map((k) => (typeof f[k] === "string" ? (f[k] as string).trim().toLowerCase() : "")));
}
