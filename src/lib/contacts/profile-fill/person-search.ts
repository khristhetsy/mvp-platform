/**
 * Free person search for LinkedIn contacts: "Search by person, then company".
 *
 * No search engine and no paid service. When the contact's firm website is known (on the
 * contact, or from the research file), read the firm's own team, people and about pages,
 * find the person's name, and take only what is published next to it:
 *   email  an address on the page that carries the person's name  → found, "published"
 *   phone  a number printed near the name                          → found, "direct line"
 *          otherwise the firm's main number                        → found, "office line"
 * A company inbox (info@, contact@…) is never proposed as the person's email, and no
 * address is ever built from a name pattern. Results are proposals for review.
 */
import { emailBelongsTo, isGenericEmail } from "@/lib/contacts/linkedin-import";
import { extractContacts, normalizePhone } from "@/lib/append/site";

export const PERSON_PATHS = ["/team", "/our-team", "/people", "/about", "/about-us", "/leadership", "/who-we-are", "/contact"];

export type PersonHit = {
  email: string | null;
  phone: string | null;
  phoneKind: "direct" | "office" | null;
  page: string | null;
  nameSeen: boolean;
};

/** Visible text of a page, with mailto: and tel: targets kept inline so they sit next to the name. Pure. */
export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/href=["']mailto:([^"'?]+)[^"']*["']/gi, " > $1 ")
    .replace(/href=["']tel:([^"']+)["']/gi, (_m, t: string) => { try { return ` > ${decodeURIComponent(t)} `; } catch { return " "; } })
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#64;|&commat;/g, "@")
    .replace(/\s+/g, " ");
}

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Find a person on one page: the name must appear in full (first and last). Then
 * an email carrying their name anywhere on the page, and a phone within the text that
 * follows the name (their card). Pure.
 */
export function findPersonOnPage(html: string, firstName: string, lastName: string): Omit<PersonHit, "page"> {
  const none = { email: null, phone: null, phoneKind: null, nameSeen: false } as Omit<PersonHit, "page">;
  const first = fold(firstName.trim()), last = fold(lastName.trim());
  if (first.length < 2 || last.length < 2) return none;
  const text = pageText(html);
  const lower = fold(text);
  const re = new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[\\s\\w.'-]{0,25}?\\b${last.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
  const hits: number[] = [];
  for (let m = re.exec(lower); m; m = re.exec(lower)) hits.push(m.index);
  if (!hits.length) return none;

  const emails = extractContacts(text).emails;
  const email = emails.find((e) => !isGenericEmail(e) && emailBelongsTo(e, firstName, lastName)) ?? null;

  // A direct line is a number printed in the person's own card: just after their name,
  // outside the page's header, nav and footer, and printed only once on the page (a number
  // repeated on every card or in the footer is the firm's main line).
  const body = fold(pageText(html.replace(/<(header|nav|footer)[\s\S]*?<\/\1>/gi, " ")));
  const bodyHits: number[] = [];
  for (let m = re.exec(body), guard = 0; m && guard < 50; m = re.exec(body), guard++) bodyHits.push(m.index);
  const allPhones = (body.match(/(?:\+|\()?\d[\d\s().-]{8,}\d/g) ?? []).map((r) => normalizePhone(r)).filter((p): p is string => Boolean(p));
  let phone: string | null = null;
  for (const at of bodyHits) {
    const card = body.slice(at, at + 220);
    for (const r of card.match(/(?:\+|\()?\d[\d\s().-]{8,}\d/g) ?? []) {
      const p = normalizePhone(r);
      if (p && allPhones.filter((x) => x === p).length === 1) { phone = p; break; }
    }
    if (phone) break;
  }
  return { email, phone, phoneKind: phone ? "direct" : null, nameSeen: true };
}

const UA = "iCapOS-contact-bot/1.0 (+https://myicfos.com)";

async function timedFetch(url: string, ms: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": UA } }); }
  catch { return null; }
  finally { clearTimeout(t); }
}

async function allowed(origin: string): Promise<boolean> {
  const res = await timedFetch(`${origin}/robots.txt`, 3000);
  if (!res || !res.ok) return true;
  const star = (await res.text()).slice(0, 20000).toLowerCase().split(/user-agent:\s*\*/).slice(1).join("\n");
  return !/disallow:\s*\/\s*(\n|$)/.test(star);
}

function origin(site: string): string | null {
  try { return new URL(site.startsWith("http") ? site : `https://${site.replace(/^www\./, "")}`).origin; }
  catch { return null; }
}

/**
 * Read the firm's own pages for this person. Free: plain page fetches only.
 * Tries person pages first (/team/first-last), then the team and about pages, then
 * falls back to the firm's main number as an office line.
 */
export async function searchPerson(site: string, firstName: string, lastName: string, budgetMs = 30000): Promise<PersonHit> {
  const base = origin(site);
  const empty: PersonHit = { email: null, phone: null, phoneKind: null, page: null, nameSeen: false };
  if (!base || !(await allowed(base))) return empty;
  const started = Date.now();
  const slug = `${firstName}-${lastName}`.toLowerCase().normalize("NFKD").replace(/[^a-z-]/g, "");
  const urls = [`${base}/team/${slug}`, `${base}/people/${slug}`, ...PERSON_PATHS.map((p) => `${base}${p}`), base];
  let best: PersonHit = empty;
  let officePhone: string | null = null;
  let officePage: string | null = null;
  for (const u of urls) {
    if (Date.now() - started > budgetMs) break;
    const res = await timedFetch(u, 6000);
    if (!res || !res.ok || !(res.headers.get("content-type") ?? "").includes("html")) continue;
    const html = (await res.text()).slice(0, 600000);
    const hit = findPersonOnPage(html, firstName, lastName);
    if (hit.nameSeen) {
      best = {
        email: best.email ?? hit.email,
        phone: best.phone ?? hit.phone,
        phoneKind: best.phone ? best.phoneKind : hit.phoneKind,
        page: best.page ?? u,
        nameSeen: true,
      };
      if (best.email && best.phone) break;
    }
    if (!officePhone) {
      const p = extractContacts(html).phones[0];
      if (p) { officePhone = p; officePage = u; }
    }
  }
  if (!best.phone && officePhone) return { ...best, phone: officePhone, phoneKind: "office", page: best.page ?? officePage };
  return best;
}
