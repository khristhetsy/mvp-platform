/**
 * Address rules for founder IR agent pages: icapos.com/[company]/[ending]
 * The company part is generated from the company name and locked. The founder
 * may only change the ending. Pure functions, shared by the page, the API and tests.
 */

/**
 * Names a company slug may never take: every top level folder under src/app,
 * plus a few routes that are likely to exist later. A slug equal to one of these
 * would be shadowed by the static route. src/lib/ir-agent/reserved.test.ts
 * fails when src/app gains a folder that is not listed here.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "about", "about-us", "admin", "api", "app", "apple-icon", "assessment", "auth",
  "billing", "blog", "campaigns", "checkout", "claim", "configuration-error", "connect",
  "contact", "contracts", "credits", "daniela", "dashboard", "deal", "deals", "deck",
  "disclosures", "dr", "e", "email", "events", "f", "favicon", "fit", "founder",
  "founders", "help", "home", "icapos", "icfo", "icon", "install", "investor",
  "investors", "invite", "jessica", "jessica2", "jessica2.0", "johnny", "khris", "learn",
  "legal", "login", "logout", "manifest", "marketing", "marketplace", "matches", "mc",
  "michael", "notifications", "offline", "onboarding", "opengraph-image", "pay", "preview",
  "pricing", "privacy", "private-market", "r", "readiness", "readiness-rating", "register",
  "robots", "schedule", "security", "settings", "share", "sign", "sign-in", "sign-up",
  "signin", "signup", "sitemap", "sponsor", "start", "submit-company", "support", "terms",
  "testimonial", "twitter-image", "unsubscribe", "upgrade", "www",
]);

export const COMPANY_SLUG_MIN = 3;
export const COMPANY_SLUG_MAX = 40;
export const ENDING_MIN = 2;
export const ENDING_MAX = 30;
export const DEFAULT_ENDING = "invest";
export const AGENT_HOST = "https://icapos.com";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyCompany(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, COMPANY_SLUG_MAX)
    .replace(/-+$/g, "");
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export type Check = { ok: true } | { ok: false; reason: string };

export function validateCompanySlug(slug: string): Check {
  if (slug.length < COMPANY_SLUG_MIN) return { ok: false, reason: "Company address is too short." };
  if (slug.length > COMPANY_SLUG_MAX) return { ok: false, reason: "Company address is too long." };
  if (!SLUG_RE.test(slug)) return { ok: false, reason: "Use letters, numbers and single hyphens only." };
  if (isReservedSlug(slug)) return { ok: false, reason: "That address is reserved." };
  return { ok: true };
}

export function validateEnding(ending: string): Check {
  if (ending.length < ENDING_MIN) return { ok: false, reason: "Ending is too short." };
  if (ending.length > ENDING_MAX) return { ok: false, reason: "Ending is too long." };
  if (!SLUG_RE.test(ending)) return { ok: false, reason: "Use lowercase letters, numbers and single hyphens only." };
  return { ok: true };
}

/** Normalize what a founder typed into the ending box: lowercase, hyphens for spaces, nothing else. */
export function normalizeEnding(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, ENDING_MAX);
}

/** Pick a free company slug. `taken` holds slugs already used by other organizations. */
export function uniqueCompanySlug(name: string, taken: ReadonlySet<string>): string {
  const base = slugifyCompany(name) || "company";
  let candidate = base;
  let n = 2;
  while (isReservedSlug(candidate) || taken.has(candidate) || candidate.length < COMPANY_SLUG_MIN) {
    const suffix = `-${n}`;
    candidate = base.slice(0, COMPANY_SLUG_MAX - suffix.length).replace(/-+$/g, "") + suffix;
    n += 1;
  }
  return candidate;
}

export function agentPath(companySlug: string, ending: string): string {
  return `/${companySlug}/${ending}`;
}

export function agentUrl(companySlug: string, ending: string, host = AGENT_HOST): string {
  return `${host}${agentPath(companySlug, ending)}`;
}

/** Tracked links per channel, used by the Share tab and the marketing composers. */
export const CHANNELS = ["email", "linkedin", "instagram", "facebook", "x", "qr"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  qr: "QR code",
};

export function trackedUrl(companySlug: string, ending: string, channel: Channel, host = AGENT_HOST): string {
  return `${agentUrl(companySlug, ending, host)}?src=${channel}`;
}
