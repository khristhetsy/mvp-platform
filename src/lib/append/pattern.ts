// Prospect Pipeline — Step 3: email pattern inference (free). Generates likely
// addresses from a name + company domain. GUARDRAIL: inferred addresses are
// marked risky and must never be cold-sent — they only become sendable after a
// provider verifies them.

// Free / personal email providers — an address here tells us nothing about a
// company website, so we never treat its domain as a company domain.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "yahoo.co.uk", "hotmail.com",
  "hotmail.co.uk", "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
  "mac.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net", "mail.com",
  "yandex.com", "yandex.ru", "zoho.com", "fastmail.com", "hey.com", "qq.com", "163.com", "126.com",
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

export function inferEmails(name: string | null | undefined, domain: string | null | undefined): string[] {
  const parts = (name ?? "").trim().toLowerCase().replace(/[^a-z\s'-]/g, "").split(/\s+/).filter(Boolean);
  const d = (domain ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (parts.length === 0 || !d) return [];

  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : null;
  const cands = new Set<string>();

  cands.add(`${first}@${d}`);
  if (last && last !== first) {
    cands.add(`${first}.${last}@${d}`);
    cands.add(`${first[0]}${last}@${d}`);
    cands.add(`${first}${last}@${d}`);
    cands.add(`${first}.${last[0]}@${d}`);
    cands.add(`${last}@${d}`);
  }
  return Array.from(cands).slice(0, 6);
}
