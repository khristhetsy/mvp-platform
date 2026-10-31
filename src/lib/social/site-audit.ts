/**
 * Site audit (Social Media Hub, Overview). Pure helpers, no IO, unit tested.
 *
 * The route fetches a few public pages of the company site and hands the HTML here.
 * The audit only reads and suggests. It never edits the site, and its findings stay
 * "proposed" until a staff member approves them.
 */

export type AuditStatus = "found" | "check" | "review";
export type AuditFinding = { key: string; label: string; detail: string; status: AuditStatus };
export type AuditPage = { url: string; ok: boolean; html: string | null };
export type PageFacts = { title: string; description: string; headings: string[]; text: string; links: string[] };

/** Pages the audit reads. Fixed list on purpose: the route never fetches an arbitrary URL. */
export const AUDIT_PATHS = ["/", "/fit", "/founders", "/investors"] as const;

/** Hosts the audit is allowed to read: icapos.com plus the app's own host. */
export function auditHostAllowed(host: string, appUrl?: string | null): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (h === "icapos.com") return true;
  try {
    if (appUrl) return new URL(appUrl).hostname.toLowerCase().replace(/^www\./, "") === h;
  } catch { /* ignore a bad app url */ }
  return false;
}

function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&nbsp;/g, " ");
}
function strip(html: string): string {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Title, description, headings, plain text and links of one page. */
export function extractFacts(html: string): PageFacts {
  const title = strip((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) ?? [])[1] ?? "");
  const desc = (/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html) ?? [])[1]
    ?? (/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html) ?? [])[1] ?? "";
  const headings: string[] = [];
  for (const m of html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const t = strip(m[2]);
    if (t) headings.push(t.slice(0, 140));
    if (headings.length >= 8) break;
  }
  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 400);
  return { title, description: decode(desc).trim(), headings, text: strip(html).slice(0, 20000), links };
}

/** Phrases a reply should never repeat: returns, guarantees and performance claims. */
const CLAIM_PATTERNS: Array<[RegExp, string]> = [
  [/\bguarantee[sd]?\b/i, "guarantee"],
  [/\brisk[- ]free\b/i, "risk free"],
  [/\b\d{1,3}(\.\d+)?\s?%\s*(return|yield|roi|irr)\b/i, "percent return"],
  [/\b(roi|irr)\b/i, "ROI or IRR"],
  [/\bfunding probability\b/i, "funding probability"],
  [/\bresponse rates?\b/i, "response rate"],
];

export function findClaims(text: string): string[] {
  const out: string[] = [];
  for (const [re, label] of CLAIM_PATTERNS) if (re.test(text) && !out.includes(label)) out.push(label);
  return out;
}

/** Build the five findings from the pages that were read. */
export function buildFindings(pages: AuditPage[]): AuditFinding[] {
  const read = pages.filter((p) => p.ok && p.html).map((p) => ({ url: p.url, f: extractFacts(p.html as string) }));
  if (!read.length) {
    return [{ key: "reach", label: "Site reachable", detail: "No page could be read. Check that the site is up, then run the audit again.", status: "check" }];
  }
  const home = read.find((r) => /\/\/[^/]+\/?$/.test(r.url)) ?? read[0];
  const all = read.map((r) => r.f.text).join(" ");
  const out: AuditFinding[] = [];

  const summary = [home.f.title, home.f.description].filter(Boolean).join(". ");
  out.push(summary
    ? { key: "product", label: "Product summary", detail: summary.slice(0, 280), status: "found" }
    : { key: "product", label: "Product summary", detail: "The home page has no title or description to summarise. Add one.", status: "check" });

  const f = /\bfounders?\b/i.test(all), i = /\binvestors?\b/i.test(all);
  out.push({
    key: "audience", label: "Audience",
    detail: f && i ? "The site speaks to founders and investors." : f ? "The site speaks to founders only." : i ? "The site speaks to investors only." : "No clear audience found on the pages read.",
    status: f || i ? "found" : "check",
  });

  const fitLinked = read.some((r) => r.f.links.some((l) => /(^|\/)fit(\?|\/|$)/i.test(l)));
  const fitRead = read.some((r) => /\/fit\/?$/.test(r.url));
  out.push({
    key: "funnel", label: "Funnel path",
    detail: fitRead ? "The /fit page is reachable, which the reply links lead to." : fitLinked ? "Pages link to /fit, but /fit itself could not be read. Check it loads." : "No link to /fit found. Reply links lead there, so check it.",
    status: fitRead ? "found" : "check",
  });

  const claims = findClaims(all);
  out.push({
    key: "claims", label: "Claims replies must avoid",
    detail: claims.length ? `Found: ${claims.join(", ")}. Keep these out of replies.` : "No return or performance claims found on the pages read.",
    status: claims.length ? "review" : "found",
  });

  const heads = home.f.headings.slice(0, 4);
  out.push({
    key: "voice", label: "Voice",
    detail: heads.length ? `Headlines to echo: ${heads.join(" | ")}` : "No headlines found to take a voice from.",
    status: heads.length ? "found" : "check",
  });
  return out;
}
