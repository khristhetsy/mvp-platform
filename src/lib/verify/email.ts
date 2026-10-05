// Prospect Pipeline — email verification (free tier). Cascade stops at what's
// possible without a paid provider or SMTP: syntax → MX (DNS) → role detection.
// Real mailbox-level verification (SMTP handshake) is blocked on serverless
// (port 25), so "valid" here only means the DOMAIN accepts mail: the mailbox
// itself is not confirmed. That is why `level` is "domain" and confidence is 50,
// and why the UI labels it "Domain OK" rather than "Valid".
// See docs/contact-finder-spec.md (D1).

import { resolveMx } from "node:dns/promises";
import { isGenericEmail } from "@/lib/contacts/linkedin-import";

export type EmailStatus = "valid" | "risky" | "invalid" | "unverified";

/** How far the check got. "mailbox" is reserved for the Step 3 SMTP worker. */
export type EmailCheckLevel = "syntax" | "domain" | "mailbox";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LOCALPARTS = new Set([
  "info", "admin", "sales", "support", "contact", "hello", "team", "noreply",
  "no-reply", "office", "billing", "help", "marketing", "press", "careers", "jobs", "hr",
  "contact-us", "enquiries", "inquiries", "ir", "investors", "partners", "bonjour", "accueil",
]);

/** Confidence for a non-role address whose domain has MX records (mailbox unconfirmed). */
export const DOMAIN_ONLY_CONFIDENCE = 50;

// Small MX cache within a single process invocation to avoid repeat lookups.
const mxCache = new Map<string, boolean>();

export interface EmailVerifyResult {
  status: EmailStatus;
  role: boolean;
  mx: boolean;
  level: EmailCheckLevel;
  confidence: number; // 0..100
}

/** True for a shared company mailbox (info@, contact@, ir@ …), never a person. */
export function isRoleAddress(email: string): boolean {
  const e = (email ?? "").trim().toLowerCase();
  const local = e.split("@")[0] ?? "";
  return ROLE_LOCALPARTS.has(local) || isGenericEmail(e);
}

export async function domainHasMx(domain: string): Promise<boolean> {
  const d = (domain ?? "").trim().toLowerCase();
  if (!d) return false;
  if (mxCache.has(d)) return mxCache.get(d)!;
  let has = false;
  try {
    const recs = await resolveMx(d);
    has = Array.isArray(recs) && recs.length > 0;
  } catch {
    has = false;
  }
  mxCache.set(d, has);
  return has;
}

/** Test hook: clear the per-process MX cache. */
export function _clearMxCache(): void {
  mxCache.clear();
}

export async function verifyEmail(email: string): Promise<EmailVerifyResult> {
  const e = (email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { status: "invalid", role: false, mx: false, level: "syntax", confidence: 0 };

  const domain = e.split("@")[1];
  const role = isRoleAddress(e);
  const mx = await domainHasMx(domain);

  if (!mx) return { status: "invalid", role, mx: false, level: "syntax", confidence: 10 };
  if (role) return { status: "risky", role: true, mx: true, level: "domain", confidence: 45 };
  return { status: "valid", role: false, mx: true, level: "domain", confidence: DOMAIN_ONLY_CONFIDENCE };
}
