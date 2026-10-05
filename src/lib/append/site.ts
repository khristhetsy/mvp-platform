// Prospect Pipeline — public-site contact scrape (free). Robots-aware,
// timed, and conservative. Emails found here are mostly company inboxes and
// phones are company lines: callers must not assign them to a person blindly. Server-side fetch of the company's own site to find
// a public email/phone. Never follows off-domain or paginates.

export interface SiteContacts {
  emails: string[];
  phones: string[];
}

const EMPTY: SiteContacts = { emails: [], phones: [] };
const UA = "iCapOS-contact-bot/1.0 (+https://myicfos.com)";

async function timedFetch(url: string, timeoutMs: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": UA } });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Best-effort robots check: skip if root is disallowed for all agents. */
async function rootAllowed(base: string): Promise<boolean> {
  const res = await timedFetch(`${base}/robots.txt`, 3000);
  if (!res || !res.ok) return true; // no robots → allowed
  const txt = (await res.text()).slice(0, 20000).toLowerCase();
  // Very light parse: if a "user-agent: *" block disallows "/", respect it.
  const star = txt.split(/user-agent:\s*\*/).slice(1).join("\n");
  return !/disallow:\s*\/\s*(\n|$)/.test(star);
}

// A run of digits that starts like a date (20260512…, 1999-12-31), a written
// date (05.12.2026, 12/05/2026) or a year range (2019-2026). These turn up in
// footers and order numbers, not phones.
const DATE_LIKE = /^(19|20)\d{2}[01]\d[0-3]\d/;
const WRITTEN_DATE = /^\d{1,2}[./-]\d{1,2}[./-](19|20)\d{2}\b/;
const ISO_DATE = /^(19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2}\b/;
const YEAR_RANGE = /^(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}$/;

function balancedParens(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Validate a scraped phone string. Returns a normalised value, or null when it
 * isn't plausibly a phone number. International numbers come back in E.164
 * ("+18585550100"); national ones keep their digits and single spaces.
 * `fromTelLink` relaxes the formatting rule: a tel: link is an explicit phone,
 * so a bare digit run ("tel:8585550100") is accepted there but not in page text,
 * where bare runs are usually IDs. See docs/contact-finder-spec.md (D5).
 */
export function normalizePhone(raw: string | null | undefined, opts: { fromTelLink?: boolean } = {}): string | null {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s || !/^\+?[\d\s().-]+$/.test(s) || !balancedParens(s)) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  if (YEAR_RANGE.test(s) || WRITTEN_DATE.test(s) || ISO_DATE.test(s)) return null;
  const international = s.startsWith("+") || s.startsWith("00");
  if (!international && DATE_LIKE.test(digits)) return null;
  const formatted = /[\s().-]/.test(s);
  if (!opts.fromTelLink && !international && !s.startsWith("0") && !formatted) return null;
  if (s.startsWith("+")) return `+${digits}`;
  if (s.startsWith("00")) return `+${digits.slice(2)}`;
  return s;
}

/** Pull public business emails/phones out of a page's HTML. */
export function extractContacts(html: string): SiteContacts {
  const emails = Array.from(
    new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((s) => s.toLowerCase())),
  )
    .filter((e) => !/(example\.|sentry|wixpress|\.png|\.jpg|\.gif|@2x)/.test(e))
    .slice(0, 10);

  // tel: links are the most reliable signal, so they go first.
  const telLinks = (html.match(/href=["']tel:([^"']+)["']/gi) ?? [])
    .map((m) => { try { return decodeURIComponent(m.replace(/^href=["']tel:/i, "").replace(/["']$/, "")); } catch { return ""; } })
    .map((p) => normalizePhone(p, { fromTelLink: true }));
  // Allow a leading "(" so "(858) 555-0100" is captured whole, not as "858) 555-0100".
  const inText = (html.match(/(?:\+|\()?\d[\d\s().-]{8,}\d/g) ?? []).map((p) => normalizePhone(p));
  const phones = Array.from(
    new Set([...telLinks, ...inText].filter((p): p is string => Boolean(p))),
  ).slice(0, 3);

  return { emails, phones };
}

/** Fetch one page (robots-aware) and extract its public contacts. */
export async function fetchPageContacts(url: string, timeoutMs = 6000): Promise<SiteContacts> {
  const raw = (url ?? "").trim();
  if (!raw) return EMPTY;
  const full = raw.startsWith("http") ? raw : `https://${raw.replace(/^www\./, "")}`;
  try {
    const origin = new URL(full).origin;
    if (!(await rootAllowed(origin))) return EMPTY;
    const res = await timedFetch(full, timeoutMs);
    if (!res || !res.ok) return EMPTY;
    const html = (await res.text()).slice(0, 500000);
    return extractContacts(html);
  } catch {
    return EMPTY;
  }
}

export async function scrapeSiteContacts(domainOrUrl: string, timeoutMs = 6000): Promise<SiteContacts> {
  const raw = (domainOrUrl ?? "").trim();
  if (!raw) return EMPTY;
  const base = raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw.replace(/^www\./, "")}`;
  return fetchPageContacts(base, timeoutMs);
}
