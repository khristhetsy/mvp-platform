// Prospect Pipeline — email pattern inference (free). Generates likely addresses
// from a name + company domain. GUARDRAIL: inferred addresses are marked risky
// and must never be cold-sent; isSendableCrmEmail() blocks them at send time
// until a mailbox check confirms them. See docs/contact-finder-spec.md (D2, D3, D7).

// Free / personal email providers — an address here tells us nothing about a
// company website, so we never treat its domain as a company domain.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "yahoo.co.uk", "hotmail.com",
  "hotmail.co.uk", "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
  "mac.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net", "mail.com",
  "yandex.com", "yandex.ru", "zoho.com", "fastmail.com", "hey.com", "qq.com", "163.com", "126.com",
  "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "laposte.net", "hotmail.fr", "yahoo.fr",
]);

/** Company domain implied by a business email address, or null for free providers. */
export function domainFromEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return null;
  const d = e.slice(at + 1).replace(/^www\./, "").trim();
  if (!d || !d.includes(".") || FREE_EMAIL_DOMAINS.has(d)) return null;
  return d;
}

/**
 * The email formats we try, in default rank order (most common first). The
 * order is the fallback used until per-domain learning (spec Step 2) exists.
 */
export const EMAIL_FORMATS = [
  "first.last", "flast", "first", "firstlast", "f.last", "first_last", "last.first", "firstl",
] as const;
export type EmailFormat = (typeof EMAIL_FORMATS)[number];

export interface EmailCandidate { format: EmailFormat; email: string }

// Name particles kept inside a surname ("de la Fontaine", "van Dyke").
const PARTICLES = new Set(["de", "du", "des", "la", "le", "van", "von", "der", "den", "di", "da", "del", "dos", "das", "ter"]);

// Letters that don't decompose under NFD, transliterated rather than dropped.
const TRANSLIT: Record<string, string> = {
  ł: "l", Ł: "l", ø: "o", Ø: "o", đ: "d", Đ: "d", ð: "d", Ð: "d", þ: "th", Þ: "th",
  æ: "ae", Æ: "ae", œ: "oe", Œ: "oe", ß: "ss", ı: "i",
};
// Honorifics and suffixes that are never part of a mailbox name.
const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "sir", "me", "mme", "mlle", "m"]);
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "phd", "md", "mba", "cfa", "cpa", "esq"]);

/** Strip accents and anything a mailbox local part can't hold. "José" → "jose", "Łukasz" → "lukasz". */
export function normalizeNamePart(s: string): string {
  return s
    .replace(/[łŁøØđĐðÐþÞæÆœŒßı]/g, (c) => TRANSLIT[c] ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z-]/g, "")
    .replace(/^-+|-+$/g, "");
}

interface NameTokens { firsts: string[]; lasts: string[] }

/**
 * Split a display name into candidate first and last tokens.
 * - Hyphenated first names give both forms: "jean-luc" and "jeanluc".
 * - A surname with particles gives the joined form ("delafontaine") plus the
 *   final word ("fontaine").
 */
export function nameTokens(name: string | null | undefined): NameTokens {
  let raw = (name ?? "").trim();
  // "Smith, John" → "John Smith" (one comma only; more is a list, leave it).
  const commas = raw.split(",");
  if (commas.length === 2 && commas[1].trim()) raw = `${commas[1].trim()} ${commas[0].trim()}`;
  const all = raw.split(/\s+/).map(normalizeNamePart).filter(Boolean);
  let words = all;
  while (words.length > 1 && TITLES.has(words[0])) words = words.slice(1);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words = words.slice(0, -1);
  if (words.length === 0) return { firsts: [], lasts: [] };

  const first = words[0];
  const firsts = Array.from(new Set([first, first.replace(/-/g, "")].filter(Boolean)));

  const rest = words.slice(1);
  if (rest.length === 0) return { firsts, lasts: [] };

  const lasts = new Set<string>();
  const finalWord = rest[rest.length - 1];
  const hasParticle = rest.slice(0, -1).some((w) => PARTICLES.has(w));
  if (hasParticle) lasts.add(rest.join("").replace(/-/g, ""));
  lasts.add(finalWord);
  lasts.add(finalWord.replace(/-/g, ""));
  return { firsts, lasts: Array.from(lasts).filter(Boolean) };
}

function localFor(format: EmailFormat, first: string, last: string | null): string | null {
  if (format === "first") return first;
  if (!last || last === first) return null;
  switch (format) {
    case "first.last": return `${first}.${last}`;
    case "flast": return `${first[0]}${last}`;
    case "firstlast": return `${first}${last}`;
    case "f.last": return `${first[0]}.${last}`;
    case "first_last": return `${first}_${last}`;
    case "last.first": return `${last}.${first}`;
    case "firstl": return `${first}${last[0]}`;
    default: return null;
  }
}

/**
 * Ranked candidates, best first. `order` lets a caller put a learned format for
 * this domain first; it defaults to EMAIL_FORMATS.
 */
export function emailCandidates(
  name: string | null | undefined,
  domain: string | null | undefined,
  order: readonly EmailFormat[] = EMAIL_FORMATS,
): EmailCandidate[] {
  const d = (domain ?? "").trim().toLowerCase().replace(/^www\./, "");
  const { firsts, lasts } = nameTokens(name);
  if (!d || firsts.length === 0) return [];

  const out: EmailCandidate[] = [];
  const seen = new Set<string>();
  const lastList: (string | null)[] = lasts.length ? lasts : [null];
  for (const format of order) {
    for (const first of firsts) {
      for (const last of lastList) {
        const local = localFor(format, first, last);
        if (!local) continue;
        const email = `${local}@${d}`;
        if (seen.has(email)) continue;
        seen.add(email);
        out.push({ format, email });
      }
    }
  }
  return out;
}

/** Back-compat: candidate addresses only, best first (max 6). */
export function inferEmails(name: string | null | undefined, domain: string | null | undefined): string[] {
  return emailCandidates(name, domain).slice(0, 6).map((c) => c.email);
}
