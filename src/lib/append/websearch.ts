// Prospect Pipeline — internet-search discovery (replaces the paid Hunter/Apollo
// step). Uses a general web search ONLY to (1) find the company's official
// website when we don't have it, and (2) locate that company's own contact /
// about / team pages. Contact info is then extracted from the company's OWN
// domain pages — never from third-party people-search or open-web PII sources.
//
// Search backend is pluggable and env-gated. With no key it's a no-op, so the
// free homepage scrape + pattern cascade runs unchanged:
//   - SERPER_API_KEY                       → Serper.dev (Google results, one key)
//   - GOOGLE_CSE_KEY + GOOGLE_CSE_CX       → Google Programmable Search JSON API

import { fetchPageContacts } from "./site";

export interface WebSearchResult { url: string; title: string }
export interface WebContactResult { email: string | null; phone: string | null; domain: string | null; source: "site" }

const MAX_PAGES = 4; // bound page fetches per contact to stay within the serverless window
const COMMON_PATHS = ["/contact", "/contact-us", "/about", "/team", "/about-us"];

export function searchConfigured(): boolean {
  return Boolean(
    process.env.SERPER_API_KEY?.trim() ||
    (process.env.GOOGLE_CSE_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim()),
  );
}

/** Run one web search. Returns [] when no search backend is configured. */
export async function webSearch(query: string, num = 6): Promise<WebSearchResult[]> {
  const q = (query ?? "").trim();
  if (!q) return [];

  const serper = process.env.SERPER_API_KEY?.trim();
  if (serper) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serper, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num }),
      });
      if (res.ok) {
        const j = (await res.json()) as { organic?: Array<{ link?: string; title?: string }> };
        return (j.organic ?? []).filter((o) => o.link).map((o) => ({ url: o.link as string, title: o.title ?? "" }));
      }
    } catch { /* search best-effort */ }
    return [];
  }

  const gKey = process.env.GOOGLE_CSE_KEY?.trim();
  const gCx = process.env.GOOGLE_CSE_CX?.trim();
  if (gKey && gCx) {
    try {
      const params = new URLSearchParams({ key: gKey, cx: gCx, q, num: String(Math.min(num, 10)) });
      const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
      if (res.ok) {
        const j = (await res.json()) as { items?: Array<{ link?: string; title?: string }> };
        return (j.items ?? []).filter((o) => o.link).map((o) => ({ url: o.link as string, title: o.title ?? "" }));
      }
    } catch { /* search best-effort */ }
  }
  return [];
}

function hostOf(url: string): string | null {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return null; }
}

// The registrable-ish root: keep the last two labels (good enough for matching
// result URLs to a company site, e.g. news.acme.com → acme.com).
function rootDomain(host: string): string {
  const parts = host.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : host;
}

const NON_COMPANY = /(linkedin|facebook|twitter|x\.com|instagram|crunchbase|bloomberg|wikipedia|youtube|glassdoor|indeed|zoominfo|apollo\.io|hunter\.io|rocketreach|google\.|yelp)/i;

/** Find a company's official website domain via web search. */
export async function discoverDomain(company: string): Promise<string | null> {
  const results = await webSearch(`${company} official website`, 6);
  for (const r of results) {
    const host = hostOf(r.url);
    if (host && !NON_COMPANY.test(host)) return rootDomain(host);
  }
  return null;
}

/**
 * Discover business contacts for a company using internet search + the company's
 * own website. Search is used only to find the domain and its contact pages;
 * extraction happens on the company's own domain. No-op without a search key.
 */
export async function searchCompanyContacts(input: { name?: string | null; company?: string | null; domain?: string | null }): Promise<WebContactResult> {
  const empty: WebContactResult = { email: null, phone: null, domain: input.domain ?? null, source: "site" };
  if (!searchConfigured()) return empty;

  let domain = input.domain ? rootDomain(hostOf(input.domain) ?? input.domain) : null;
  if (!domain && input.company) domain = await discoverDomain(input.company);
  if (!domain) return empty;

  // Candidate pages: search hits on the company's own domain + common paths.
  const queryTerm = (input.company || domain).trim();
  const hits = await webSearch(`${queryTerm} contact email phone`, 8);
  const onDomain = hits.map((h) => h.url).filter((u) => { const h = hostOf(u); return h ? rootDomain(h) === domain : false; });
  const urls = Array.from(new Set([
    ...onDomain,
    ...COMMON_PATHS.map((p) => `https://${domain}${p}`),
  ])).slice(0, MAX_PAGES);

  let email: string | null = null;
  let phone: string | null = null;
  for (const u of urls) {
    if (email && phone) break;
    const c = await fetchPageContacts(u);
    // Prefer an email on the company's own domain (a real business mailbox).
    if (!email) email = c.emails.find((e) => e.endsWith(`@${domain}`)) ?? c.emails[0] ?? null;
    if (!phone) phone = c.phones[0] ?? null;
  }

  return { email, phone, domain, source: "site" };
}
