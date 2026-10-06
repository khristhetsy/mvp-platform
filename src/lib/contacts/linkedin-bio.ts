/**
 * Bios for LinkedIn-imported contacts (server only).
 *
 * The LinkedIn export has name, company, title and link, and a LinkedIn profile can't be
 * read without a login. So a bio is drafted only from pages the person's firm or an event
 * publishes about them: one web search for "name" + company, then up to two pages that
 * mention the person (the firm's own site first, then speaker or event pages). People
 * search and data broker sites are never read. The AI may use only those pages and the
 * LinkedIn title, and must return null when they say nothing about the person.
 *
 * The bio is saved as a draft: overrides "Bio" with _bio_source = "inferred:ai" and the
 * pages used under _bio_sources. The contact window shows it with its tag; confirming it
 * there removes the tag (existing confirm flow). Never written to a matching field.
 * Searches and AI bill to the Data enrichment budget.
 */
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { assertAiBudget, isAiBudgetExceeded } from "@/lib/ai-budget/service";
import { serperCostPerSearch } from "@/lib/ai-budget/config";
import { webSearch, searchConfigured } from "@/lib/append/websearch";
import { pageText } from "@/lib/contacts/fill-missing";
import { mergeOverrides } from "@/lib/sales/overrides";
import { claudeComplete, isClaudeConfigured, CLAUDE_HAIKU } from "@/lib/claude";
import type { EnrichGroup } from "./linkedin-enrich";

export const BIO_KEY = "Bio";
export const BIO_SOURCE_KEY = "_bio_source";
export const BIO_PAGES_KEY = "_bio_sources";

/** Hosts never read for a bio: LinkedIn itself and people search or data broker sites. */
const BLOCKED_HOSTS = [
  "linkedin.com", "zoominfo.com", "rocketreach.co", "apollo.io", "lusha.com", "spokeo.com", "whitepages.com",
  "signalhire.com", "contactout.com", "peoplefinders.com", "truepeoplesearch.com", "beenverified.com",
  "radaris.com", "clustrmaps.com", "nuwber.com", "fastpeoplesearch.com", "idcrawl.com", "theorg.com",
  "crunchbase.com", "pitchbook.com", "cbinsights.com", "facebook.com", "instagram.com", "x.com", "twitter.com",
];

export function hostOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

export function isBlockedHost(host: string): boolean {
  return BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`));
}

/** Pick up to `max` pages: the firm's own domain first, then any other allowed page. Pure. */
export function pickBioPages(urls: string[], firmDomain: string | null, max = 2): string[] {
  const firm = firmDomain ? firmDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase() : null;
  const allowed = urls.filter((u) => { const h = hostOf(u); return h && !isBlockedHost(h) && !/\.pdf($|\?)/i.test(u); });
  const own = firm ? allowed.filter((u) => { const h = hostOf(u)!; return h === firm || h.endsWith(`.${firm}`); }) : [];
  const other = allowed.filter((u) => !own.includes(u));
  return [...new Set([...own, ...other])].slice(0, max);
}

/** A page counts only when it names the person: last name and first name both appear. Pure. */
export function mentionsPerson(text: string, first: string | null, last: string | null): boolean {
  const t = text.toLowerCase();
  const l = (last ?? "").trim().toLowerCase();
  const f = (first ?? "").trim().toLowerCase();
  if (l.length < 2) return false;
  return t.includes(l) && (!f || t.includes(f));
}

/** Read the model's reply: {"bio": string|null}. Pure. */
export function parseBio(text: string): string | null {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    const v = (JSON.parse(text.slice(s, e + 1)) as { bio?: unknown }).bio;
    if (typeof v !== "string") return null;
    const bio = v.replace(/\s+/g, " ").replace(/\s[–—-]\s/g, ", ").trim();
    return bio.length >= 40 ? bio.slice(0, 900) : null;
  } catch { return null; }
}

const SYSTEM = `You write a short professional bio of one person for an investor relations CRM.
Use ONLY the page text provided and the LinkedIn title. Do not add anything those do not state: no guessed numbers, ages, schools, deals or opinions.
Two or three sentences, third person, plain words, no dashes as punctuation.
If the pages do not clearly describe this person, return {"bio": null}.
Reply with JSON only: {"bio": string|null}`;

const UA = "iCapOS-enrichment/1.0 (+https://icapos.com)";
async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(5000), headers: { "user-agent": UA, accept: "text/html" } });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|text\/plain/i.test(type)) return null;
    return pageText((await res.text()).slice(0, 300000)).slice(0, 5000);
  } catch { return null; }
}

export type BioRow = { contactId: string; name: string | null; company: string | null; bio: string | null; pages: string[]; result: "written" | "no_pages" | "not_described" };
export type BioBatch = { people: number; rows: BioRow[]; budgetReached: boolean; outOfTime: boolean; notConfigured?: boolean };

type Pending = { id: string; name: string | null; company: string | null; website: string | null; company_domain: string | null; raw: Record<string, unknown> | null };

/** Contacts still without a bio, for one group. */
async function nextPending(group: EnrichGroup, limit: number): Promise<Pending[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();
  let q = db.from("crm_contacts")
    .select("id, name, company, website, company_domain, raw")
    .eq("source", "linkedin")
    .not("company", "is", null)
    .is(`overrides->>${BIO_KEY}`, null)
    .is(`overrides->>${BIO_SOURCE_KEY}`, null)
    .limit(limit);
  if (group !== "all") q = q.contains("raw", { linkedin: { group } });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Pending[];
}

/** Draft one person's bio. Writes the draft (or a "none found" marker so the person isn't retried). */
async function bioFor(p: Pending): Promise<BioRow> {
  const li = ((p.raw?.linkedin ?? {}) as Record<string, unknown>);
  const first = (li.first_name as string | undefined) ?? (p.name ?? "").split(" ")[0] ?? null;
  const last = (li.last_name as string | undefined) ?? (p.name ?? "").split(" ").slice(-1)[0] ?? null;
  const title = (p.raw?.function as string | undefined) ?? (li.position as string | undefined) ?? null;
  const base: Omit<BioRow, "result"> = { contactId: p.id, name: p.name, company: p.company, bio: null, pages: [] };

  const hits = await webSearch(`"${p.name}" ${p.company ?? ""}`.trim(), 8);
  const pages = pickBioPages(hits.map((h) => h.url), p.company_domain || p.website);
  const texts: Array<{ url: string; text: string }> = [];
  for (const url of pages) {
    const text = await fetchText(url);
    if (text && mentionsPerson(text, first, last)) texts.push({ url, text });
  }
  if (texts.length === 0) {
    await mergeOverrides(p.id, { set: { [BIO_SOURCE_KEY]: "none:no_pages" } }, "linkedin bio: none");
    return { ...base, result: "no_pages" };
  }

  const prompt = [
    `Person: ${p.name}`,
    `Company: ${p.company ?? "unknown"}`,
    `LinkedIn title: ${title ?? "unknown"}`,
    ...texts.map((t, i) => `Page ${i + 1} (${t.url}):\n"""\n${t.text}\n"""`),
  ].join("\n\n");
  const reply = await claudeComplete([{ role: "user", content: prompt }], {
    model: CLAUDE_HAIKU, system: SYSTEM, maxTokens: 300, temperature: 0, locale: "en",
    usage: { category: "enrichment", feature: "linkedin_bio" },
  });
  const bio = parseBio(reply);
  const used = texts.map((t) => t.url);
  if (!bio) {
    await mergeOverrides(p.id, { set: { [BIO_SOURCE_KEY]: "none:not_described" } }, "linkedin bio: none");
    return { ...base, pages: used, result: "not_described" };
  }
  await mergeOverrides(p.id, { set: { [BIO_KEY]: bio, [BIO_SOURCE_KEY]: "inferred:ai", [BIO_PAGES_KEY]: used.join(" ") } }, "linkedin bio: draft");
  return { ...base, bio, pages: used, result: "written" };
}

/** One batch of bios, stopping at the time budget or the Data enrichment budget. */
export async function runBioBatch(group: EnrichGroup, limit: number, timeBudgetMs: number): Promise<BioBatch> {
  const started = Date.now();
  if (!searchConfigured() || !isClaudeConfigured()) return { people: 0, rows: [], budgetReached: false, outOfTime: false, notConfigured: true };
  const perPerson = serperCostPerSearch();
  try { await assertAiBudget("enrichment", perPerson); }
  catch (e) { if (isAiBudgetExceeded(e)) return { people: 0, rows: [], budgetReached: true, outOfTime: false }; throw e; }

  const pending = await nextPending(group, limit);
  const rows: BioRow[] = [];
  let budgetReached = false, outOfTime = false;
  for (const p of pending) {
    if (Date.now() - started > timeBudgetMs) { outOfTime = true; break; }
    try {
      await assertAiBudget("enrichment", perPerson);
      rows.push(await bioFor(p));
    } catch (e) {
      if (isAiBudgetExceeded(e)) { budgetReached = true; break; }
      throw e;
    }
  }
  return { people: rows.length, rows, budgetReached, outOfTime };
}

/** How many LinkedIn contacts in a group have a bio draft, none found, or are still waiting. */
export async function bioStats(group: EnrichGroup): Promise<{ total: number; written: number; none: number; pending: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = serviceRoleClientUntyped();
  const base = () => {
    let q = db.from("crm_contacts").select("id", { count: "exact", head: true }).eq("source", "linkedin");
    if (group !== "all") q = q.contains("raw", { linkedin: { group } });
    return q;
  };
  const [total, written, none] = await Promise.all([
    base(),
    base().not(`overrides->>${BIO_KEY}`, "is", null),
    base().like(`overrides->>${BIO_SOURCE_KEY}`, "none:%"),
  ]);
  const t = total.count ?? 0, w = written.count ?? 0, n = none.count ?? 0;
  return { total: t, written: w, none: n, pending: Math.max(0, t - w - n) };
}
