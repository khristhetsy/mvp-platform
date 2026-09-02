// Free, no-vendor email screening. This is NOT mailbox verification — it cannot confirm
// an address exists or detect a catch-all (that needs SMTP, which our stack can't do for
// free). It only weeds out the obviously-bad: malformed syntax, dead domains (no MX),
// disposable domains, and role addresses. Result is "screened" (best free confidence),
// never "verified". Promote stays gated on real verification.

export type ScreenStatus = "screened" | "risky" | "invalid";

// Small curated lists — deliberately conservative. Not exhaustive; catches the common cases.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "temp-mail.org", "tempmail.com",
  "throwawaymail.com", "yopmail.com", "getnada.com", "trashmail.com", "sharklasers.com",
  "maildrop.cc", "dispostable.com", "fakeinbox.com", "mailnesia.com", "mohmal.com",
]);

const ROLE_LOCALPARTS = new Set([
  "info", "sales", "support", "admin", "administrator", "contact", "hello", "team", "billing",
  "marketing", "noreply", "no-reply", "office", "hr", "jobs", "careers", "help", "enquiries",
  "inquiries", "accounts", "webmaster", "postmaster", "abuse",
]);

// Pragmatic RFC-ish syntax check — good enough to reject garbage without rejecting valid
// real-world addresses.
const SYNTAX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidSyntax(email: string): boolean {
  return SYNTAX.test(email.trim());
}

export function localPart(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at).toLowerCase() : "";
}

export function domainPart(email: string): string {
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase().trim() : "";
}

export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

export function isRoleAddress(email: string): boolean {
  return ROLE_LOCALPARTS.has(localPart(email));
}

// Classify from the free signals. `hasMx` is resolved by the caller (DNS lookup).
export function classifyScreen(email: string, hasMx: boolean): { status: ScreenStatus; reason: string } {
  const e = email.trim().toLowerCase();
  if (!isValidSyntax(e)) return { status: "invalid", reason: "Malformed address" };
  const domain = domainPart(e);
  if (!hasMx) return { status: "invalid", reason: `No mail server (MX) for ${domain}` };
  if (isDisposableDomain(domain)) return { status: "risky", reason: "Disposable domain" };
  if (isRoleAddress(e)) return { status: "risky", reason: "Role address (not a person)" };
  return { status: "screened", reason: "Syntax OK, domain accepts mail — not mailbox-verified" };
}
