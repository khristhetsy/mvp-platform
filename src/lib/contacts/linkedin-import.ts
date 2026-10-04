/**
 * LinkedIn connections import (Contacts ⚙ → Import LinkedIn connections).
 *
 * Pure helpers shared by the import page, its API routes and tests:
 *   - parse LinkedIn's Connections.csv (it opens with a few lines of notes before the header)
 *   - the keys used to find a connection that is already in Contacts: LinkedIn profile slug,
 *     email, and a normalised name (person_name_key in SQL mirrors nameKey here)
 *   - which group a connection falls in (investor / founder / other) from its title and
 *     company, used only to order the website enrichment, never stored as contact type
 *   - personal versus general mailbox, so a company's info@ address never lands in a
 *     person's email field or merges two people
 */
import { parseCsvCells } from "./field-mapping";

export type LinkedinGroup = "investor" | "founder" | "other";

export interface LinkedinConnection {
  slug: string;
  url: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string | null;
  company: string | null;
  position: string | null;
  connectedOn: string | null;
  group: LinkedinGroup;
}

export interface ParsedConnections {
  rows: LinkedinConnection[];
  /** Rows LinkedIn exports blank because the member hides their profile. */
  hidden: number;
  /** Same profile listed twice in the file. */
  repeated: number;
}

const SLUG = /linkedin\.com\/in\/([A-Za-z0-9_%\-.]+)/i;

/** The profile slug from a LinkedIn profile URL, lowercased. Null when there is none. */
export function linkedinSlug(url: string | null | undefined): string | null {
  const m = (url ?? "").match(SLUG);
  if (!m) return null;
  const s = m[1].replace(/[.\-_]+$/, "").toLowerCase();
  return s || null;
}

/** Same rule as SQL person_name_key: lowercase, anything but a-z0-9 becomes one space. */
export function nameKey(name: string | null | undefined): string | null {
  const k = (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return k || null;
}

/** Same rule as SQL phone_key: the last 9 digits, when there are at least 9. */
export function phoneKey(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : null;
}

/** Company name compared loosely: case, punctuation and legal suffixes ignored. */
export function companyKey(company: string | null | undefined): string | null {
  const k = (company ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|company|sa|sas|gmbh|plc|lp|llp|bv|ag)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return k || null;
}

const INVESTOR = /\b(investor|investors|investment|investments|venture|ventures|vc|angel|angels|principal|managing director|family office|private equity|capital|fund|funds|limited partner|general partner|syndicate)\b/i;
const INVESTOR_TITLE = /\b(partner|managing partner|general partner)\b/i;
const FOUNDER = /\b(founder|co ?founder|ceo|chief executive|owner|president)\b/i;

/**
 * Investor when the title or company reads like an investor (venture, fund, capital,
 * angel…) or the title is a partner at such a firm; founder when the title is founder,
 * CEO, owner or president; everyone else is other.
 */
export function classifyConnection(position: string | null, company: string | null): LinkedinGroup {
  const p = position ?? "";
  const c = company ?? "";
  if (INVESTOR.test(p) || INVESTOR.test(c)) return "investor";
  if (INVESTOR_TITLE.test(p) && INVESTOR.test(c)) return "investor";
  if (FOUNDER.test(p)) return "founder";
  return "other";
}

const GENERIC_LOCAL = /^(info|contact|contacts|hello|hi|office|admin|team|mail|enquiries|enquiry|inquiries|inquiry|general|support|sales|press|media|marketing|careers|jobs|hr|invest|investors|ir|deals|dealflow|pitch|partners|bonjour|accueil|reception|webmaster|noreply|no-reply)$/i;

/** A company mailbox (info@, contact@, team@…) rather than a person's address. */
export function isGenericEmail(email: string): boolean {
  const local = email.split("@")[0] ?? "";
  return GENERIC_LOCAL.test(local);
}

/** True when the address's local part carries this person's first or last name (3+ letters). */
export function emailBelongsTo(email: string, firstName: string | null, lastName: string | null): boolean {
  if (isGenericEmail(email)) return false;
  const local = (email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const parts = [firstName, lastName]
    .map((s) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z]/g, ""))
    .filter((s) => s.length >= 3);
  return parts.some((p) => local.includes(p));
}

/**
 * Parse LinkedIn's Connections.csv. Skips LinkedIn's notes above the header, rows with
 * no profile (hidden members) and repeated profiles.
 */
export function parseConnectionsCsv(text: string): ParsedConnections {
  const cells = parseCsvCells(text);
  const headAt = cells.findIndex((r) => r.map((c) => c.trim().toLowerCase()).includes("first name") && r.map((c) => c.trim().toLowerCase()).includes("url"));
  if (headAt < 0) throw new Error("This isn't a LinkedIn Connections file. Use Connections.csv from your LinkedIn data export.");
  const head = cells[headAt].map((c) => c.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);
  const iFirst = col("first name"), iLast = col("last name"), iUrl = col("url"), iEmail = col("email address"),
    iCompany = col("company"), iPos = col("position"), iOn = col("connected on");
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const rows: LinkedinConnection[] = [];
  const seen = new Set<string>();
  let hidden = 0, repeated = 0;
  for (const r of cells.slice(headAt + 1)) {
    if (r.every((c) => !c.trim())) continue;
    const url = get(r, iUrl);
    const slug = linkedinSlug(url);
    const firstName = get(r, iFirst), lastName = get(r, iLast);
    if (!slug || !(firstName || lastName)) { hidden++; continue; }
    if (seen.has(slug)) { repeated++; continue; }
    seen.add(slug);
    const email = get(r, iEmail).toLowerCase();
    const company = get(r, iCompany) || null;
    const position = get(r, iPos) || null;
    rows.push({
      slug,
      url: url.startsWith("http") ? url : `https://${url}`,
      firstName, lastName,
      name: [firstName, lastName].filter(Boolean).join(" "),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
      company, position,
      connectedOn: get(r, iOn) || null,
      group: classifyConnection(position, company),
    });
  }
  return { rows, hidden, repeated };
}

/** How a connection relates to Contacts after matching. */
export type MatchKind = "linkedin" | "email" | "name" | "new";

export interface MatchCandidate { kind: Exclude<MatchKind, "new">; id: string; name: string | null; company: string | null }

/**
 * The strongest match wins: same LinkedIn profile, then same email, then same name.
 * Name matches are listed for review; the default is to merge only when exactly one
 * contact has that name, otherwise skip so nobody is merged into the wrong person.
 */
export function decideMatch(cands: MatchCandidate[]): { kind: MatchKind; candidates: MatchCandidate[]; defaultTarget: string | null } {
  for (const kind of ["linkedin", "email", "name"] as const) {
    const of = cands.filter((c) => c.kind === kind);
    const uniq = of.filter((c, i) => of.findIndex((x) => x.id === c.id) === i);
    if (uniq.length) return { kind, candidates: uniq, defaultTarget: kind === "name" && uniq.length > 1 ? null : uniq[0].id };
  }
  return { kind: "new", candidates: [], defaultTarget: null };
}
