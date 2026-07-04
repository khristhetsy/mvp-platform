// Prospect Pipeline — Step 3: email verification (free tier). Cascade stops at
// what's possible without a paid provider or SMTP: syntax → MX (DNS) → role
// detection. Real mailbox-level verification (SMTP handshake) is blocked on
// serverless (port 25), so a domain-deliverable, non-role address is our best
// free signal ("valid", confidence ~75). The provider adapter raises that later.

import { resolveMx } from "node:dns/promises";

export type EmailStatus = "valid" | "risky" | "invalid" | "unverified";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LOCALPARTS = new Set([
  "info", "admin", "sales", "support", "contact", "hello", "team", "noreply",
  "no-reply", "office", "billing", "help", "marketing", "press", "careers", "jobs", "hr",
]);

// Small MX cache within a single process invocation to avoid repeat lookups.
const mxCache = new Map<string, boolean>();

export interface EmailVerifyResult {
  status: EmailStatus;
  role: boolean;
  mx: boolean;
  confidence: number; // 0..100
}

async function domainHasMx(domain: string): Promise<boolean> {
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  let has = false;
  try {
    const recs = await resolveMx(domain);
    has = Array.isArray(recs) && recs.length > 0;
  } catch {
    has = false;
  }
  mxCache.set(domain, has);
  return has;
}

export async function verifyEmail(email: string): Promise<EmailVerifyResult> {
  const e = (email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { status: "invalid", role: false, mx: false, confidence: 0 };

  const [local, domain] = e.split("@");
  const role = ROLE_LOCALPARTS.has(local);
  const mx = await domainHasMx(domain);

  if (!mx) return { status: "invalid", role, mx: false, confidence: 10 };
  if (role) return { status: "risky", role: true, mx: true, confidence: 45 };
  return { status: "valid", role: false, mx: true, confidence: 75 };
}
