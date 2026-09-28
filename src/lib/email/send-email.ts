/**
 * Thin email-sending wrapper around the Resend REST API.
 * Fails silently when RESEND_API_KEY is not configured so the app
 * works in local/staging environments without email set up.
 *
 * Required env vars:
 *   RESEND_API_KEY   — from https://resend.com/api-keys
 *   EMAIL_FROM       — e.g. "iCapOS <no-reply@icapos.com>" (must be on a domain
 *                      verified in Resend; see resolveFrom below)
 */

import { recordDelivery } from "@/lib/cron/job-deliveries";

const RESEND_API = "https://api.resend.com/emails";

/** Split a comma/semicolon-separated recipient string (or array) into clean addresses. */
export function parseRecipients(value?: string | string[] | null): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(/[,;]/);
  return list.map((s) => s.trim()).filter((s) => s.includes("@"));
}

export type EmailPayload = {
  to: string | string[];
  cc?: string | string[] | null;
  bcc?: string | string[] | null;
  subject: string;
  html: string;
  /** Optional plain-text fallback */
  text?: string;
  replyTo?: string;
  /** Personalize the From display name (e.g. the sender's name) while keeping
   *  the verified platform sending address. */
  fromName?: string;
  /** File attachments — base64 content (Resend format). */
  attachments?: Array<{ filename: string; content: string }>;
  /** Resend tags, echoed back on webhook events (letters, digits, _ and - only). */
  tags?: Array<{ name: string; value: string }>;
};

// Must be an address on a domain verified for sending in Resend. icapos.com is
// verified; mail.icapos.com and resend.dev are NOT — sending from those 403s.
export const VERIFIED_FROM_ADDRESS = "no-reply@icapos.com";
const DEFAULT_FROM_NAME = "iCapOS";
const UNVERIFIED_SENDING_DOMAINS = new Set(["mail.icapos.com", "resend.dev"]);

type ParsedFrom = { name: string | null; address: string };

/** Parse "Name <addr>" or a bare "addr". Blank or address-less values return null. */
export function parseFromHeader(raw: string | null | undefined): ParsedFrom | null {
  const value = raw?.trim();
  if (!value) return null;
  const m = value.match(/^(.*?)<([^>]+)>\s*$/);
  const address = (m ? m[2] : value).trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) return null;
  const name = m ? m[1].replace(/"/g, "").trim() || null : null;
  return { name, address };
}

/**
 * The From header for every platform email. Tries each env var in `envKeys`
 * in order and uses the first usable one; a blank value, a value with no
 * address, or an address on a domain Resend has not verified is skipped, so a
 * missing or mistyped env var can never make a send 403. With nothing usable,
 * falls back to VERIFIED_FROM_ADDRESS. `displayName` replaces the configured
 * name (the address always stays the verified one).
 */
export function resolveFrom(
  opts: { displayName?: string | null; envKeys?: readonly string[] } = {},
): string {
  const keys = opts.envKeys ?? ["EMAIL_FROM"];
  let picked: ParsedFrom | null = null;
  for (const key of keys) {
    const parsed = parseFromHeader(process.env[key]);
    if (!parsed) continue;
    const domain = parsed.address.split("@")[1]?.toLowerCase() ?? "";
    if (UNVERIFIED_SENDING_DOMAINS.has(domain)) {
      console.warn(`[email] ${key} uses ${domain}, which is not verified in Resend. Sending from ${VERIFIED_FROM_ADDRESS} instead.`);
      continue;
    }
    picked = parsed;
    break;
  }
  const address = picked?.address ?? VERIFIED_FROM_ADDRESS;
  const clean = (v: string | null | undefined) => (v ?? "").replace(/[<>"]/g, "").trim();
  const name = clean(opts.displayName) || clean(picked?.name) || DEFAULT_FROM_NAME;
  return `${name} <${address}>`;
}

/** Env vars for transactional mail, most specific first. */
export const TRANSACTIONAL_FROM_ENV = ["TRANSACTIONAL_EMAIL_FROM", "EMAIL_FROM"] as const;

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const result = await sendEmailNow(payload);
  // Inside a scheduled job, the send is recorded for its Sent tab. No-op otherwise.
  await recordDelivery({
    channel: "email",
    toEmail: parseRecipients(payload.to).join(", ") || null,
    subject: payload.subject,
    bodyHtml: payload.html,
    status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
    error: result.error ?? null,
  });
  return result.ok;
}

async function sendEmailNow(payload: EmailPayload): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveFrom({ displayName: payload.fromName });

  if (!apiKey) {
    // Not configured — log in dev, skip silently in prod
    if (process.env.NODE_ENV !== "production") {
      console.info("[email] RESEND_API_KEY not set — skipping email:", payload.subject);
    }
    return { ok: false, skipped: true, error: "Email sending is not configured" };
  }

  try {
    // Resend allows 10 requests/second. Bulk sends (event introductions) can
    // exceed that, so a 429 waits (Retry-After, else a short backoff) and retries.
    const MAX_ATTEMPTS = 4;
    let res: Response | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: parseRecipients(payload.to),
          cc: parseRecipients(payload.cc).length ? parseRecipients(payload.cc) : undefined,
          bcc: parseRecipients(payload.bcc).length ? parseRecipients(payload.bcc) : undefined,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          reply_to: payload.replyTo,
          attachments: payload.attachments && payload.attachments.length > 0 ? payload.attachments : undefined,
          tags: payload.tags && payload.tags.length > 0 ? payload.tags : undefined,
        }),
      });
      if (res.status !== 429 || attempt === MAX_ATTEMPTS) break;
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : 400 * attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    if (!res) return { ok: false, error: "Send failed" };

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend error:", res.status, body);
      return { ok: false, error: `Email provider error ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}
