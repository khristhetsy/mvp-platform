// Prospect Pipeline — Step 3: public-site contact scrape (free). Robots-aware,
// timed, and conservative. Server-side fetch of the company's own site to find
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

/** Pull public business emails/phones out of a page's HTML. */
export function extractContacts(html: string): SiteContacts {
  const emails = Array.from(
    new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((s) => s.toLowerCase())),
  )
    .filter((e) => !/(example\.|sentry|wixpress|\.png|\.jpg|\.gif|@2x)/.test(e))
    .slice(0, 5);

  const phones = Array.from(
    new Set((html.match(/\+?\d[\d\s().-]{8,}\d/g) ?? []).map((s) => s.trim())),
  )
    .filter((p) => p.replace(/\D/g, "").length >= 9 && p.replace(/\D/g, "").length <= 15)
    .slice(0, 3);

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
