/**
 * Thin email-sending wrapper around the Resend REST API.
 * Fails silently when RESEND_API_KEY is not configured so the app
 * works in local/staging environments without email set up.
 *
 * Required env vars:
 *   RESEND_API_KEY   — from https://resend.com/api-keys
 *   EMAIL_FROM       — e.g. "iCapOS <no-reply@mail.icapos.com>"
 */

const RESEND_API = "https://api.resend.com/emails";

export type EmailPayload = {
  to: string | string[];
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
};

const DEFAULT_FROM = "iCapOS <no-reply@mail.icapos.com>";

/** Bare address from EMAIL_FROM, whether it's "Name <addr>" or just "addr". */
function baseFromAddress(): string {
  const raw = process.env.EMAIL_FROM ?? DEFAULT_FROM;
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim();
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = payload.fromName
    ? `${payload.fromName.replace(/[<>"]/g, "").trim()} <${baseFromAddress()}>`
    : process.env.EMAIL_FROM ?? DEFAULT_FROM;

  if (!apiKey) {
    // Not configured — log in dev, skip silently in prod
    if (process.env.NODE_ENV !== "production") {
      console.info("[email] RESEND_API_KEY not set — skipping email:", payload.subject);
    }
    return false;
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo,
        attachments: payload.attachments && payload.attachments.length > 0 ? payload.attachments : undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend error:", res.status, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return false;
  }
}
