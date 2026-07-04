// Prospect Pipeline — shared contact-intake types (Step 1).

export type ContactSide = "founder" | "investor";

/** A single parsed inbound contact from any source before dedupe/insert. */
export interface ParsedContact {
  email?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  website?: string | null;
  phone?: string | null;
  side?: ContactSide | null;
  note?: string | null;
}

export type ImportSource = "csv" | "xlsx" | "vcard" | "manual" | "icapos";

export interface ImportResult {
  inserted: number;
  merged: number;
  skipped: number;
  total: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string | null | undefined): boolean {
  return !!value && EMAIL_RE.test(value.trim());
}

/** Derive a bare company domain from a website URL or an email address. */
export function deriveDomain(website?: string | null, email?: string | null): string | null {
  const fromSite = (website ?? "").trim();
  if (fromSite) {
    try {
      const u = new URL(fromSite.startsWith("http") ? fromSite : `https://${fromSite}`);
      return u.hostname.replace(/^www\./, "").toLowerCase() || null;
    } catch {
      /* fall through to email */
    }
  }
  const at = (email ?? "").split("@")[1]?.trim().toLowerCase();
  // ignore free-mail domains for company_domain purposes
  const FREE = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"]);
  return at && !FREE.has(at) ? at : null;
}

/** Split a full name into first/last, best-effort. */
export function splitName(name?: string | null): { first: string | null; last: string | null } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}
