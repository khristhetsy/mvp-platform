import crypto from "crypto";
import type { SendResult } from "./types";

import { absolutizeEmailHtml } from "@/lib/email/absolutize-html";

const RESEND_API_URL = "https://api.resend.com/emails";

function getApiKey(): string | null {
  const raw = process.env.RESEND_API_KEY;
  if (!raw) return null;
  // Be tolerant of common copy/paste artifacts that make Resend reject the token
  // as "malformed": surrounding quotes, a stray "Bearer " prefix, and any
  // embedded whitespace/newlines (a valid Resend key contains none of these).
  const cleaned = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^bearer\s+/i, "")
    .replace(/\s+/g, "");
  return cleaned || null;
}

/** True when the email provider (Resend) is configured and can actually deliver. */
export function emailConfigured(): boolean {
  return Boolean(getApiKey());
}

// Replace merge fields in subject/body. Tolerant of the many ways people write
// them: {{first_name}}, {first_name}, {First Name}, {Company}, {Your Name} — both
// single/double braces, any case, spaces or underscores. Only known tokens are
// replaced, so CSS/HTML braces are never touched. Fixes literal "Hi {First Name},"
// leaking into sent mail (which reads as spam to filters and recipients).
export function interpolate(text: string, vars: Record<string, string>): string {
  const known: Record<string, string> = {};
  const add = (aliases: string[], val: string) => aliases.forEach((a) => { known[a] = val; });
  add(["first_name", "firstname", "fname"], vars.first_name ?? "");
  add(["last_name", "lastname", "lname"], vars.last_name ?? "");
  add(["company", "company_name", "organization"], vars.company ?? "");
  add(["email", "email_address"], vars.email ?? "");
  add(["your_name", "sender_name", "from_name"], vars.sender_name ?? "");
  return text.replace(/\{\{?\s*([A-Za-z][\w ]*?)\s*\}?\}/g, (m, tok: string) => {
    const key = tok.trim().toLowerCase().replace(/\s+/g, "_");
    return key in known ? known[key] : m;
  });
}

/** Minimal HTML→text so every email carries a real plain-text part (deliverability). */
// Remove HTML comments (including template author notes and IE conditional comments)
// so they can't render as visible text in the delivered email.
export function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * True when a template already renders its own iCapOS brand mark, so we shouldn't also
 * prepend the automatic branded header (which would show the logo twice). Matches an
 * <img> whose alt is the brand or whose src looks like a logo asset.
 */
export function hasOwnBrandLogo(html: string): boolean {
  return /<img[^>]*(?:alt=["']\s*icapos\s*["']|src=["'][^"']*logo[^"']*["'])/i.test(html);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>(?!\n)/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type SendMarketingEmailInput = {
  to: string;
  first_name?: string | null;
  company?: string | null;
  from_name: string;
  from_email: string;
  reply_to?: string | null;
  subject: string;
  html_body: string;
  text_body?: string | null;
  /** Signed token for unsubscribe link */
  unsubscribe_token: string;
};

export async function sendMarketingEmail(
  input: SendMarketingEmailInput
): Promise<SendResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { resend_id: null, ok: false, error: "RESEND_API_KEY not configured" };
  }

  const vars: Record<string, string> = {
    first_name: input.first_name ?? "there",
    company: input.company ?? "",
    email: input.to,
    sender_name: input.from_name ?? "",
  };

  const subject = interpolate(input.subject, vars);
  // Strip HTML comments so template authoring notes (e.g. "<!-- to add more; delete to
  // remove … -->") never leak into the delivered email, then rewrite any relative
  // src/href to absolute — delivered mail has no base URL, so a relative logo path
  // renders as a broken image in the inbox.
  const htmlBody = absolutizeEmailHtml(stripHtmlComments(interpolate(input.html_body, vars)));
  // Always send a plain-text alternative — derive one from the HTML if none was
  // authored. Missing text parts are a real spam signal.
  const textBody = input.text_body ? interpolate(input.text_body, vars) : htmlToText(htmlBody);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${input.unsubscribe_token}`;

  // Branded header with an ABSOLUTE, hosted logo so it renders in delivered mail (not just
  // the editor). Point EMAIL_LOGO_URL at the CDN asset; falls back to an app-hosted path.
  const logoUrl = process.env.EMAIL_LOGO_URL ?? `${appUrl}/email-logo.png`;
  const brandHeader = `<div style="text-align:center;padding:20px 0 12px;">
  <a href="${appUrl}" style="text-decoration:none;">
    <img src="${logoUrl}" alt="iCapOS" width="132" style="display:inline-block;max-width:132px;height:auto;border:0;" />
  </a>
</div>`;

  // Templates that carry their own logo (e.g. the investor digest) already brand
  // themselves — adding the header would stack two logos.
  const htmlWithFooter = `${hasOwnBrandLogo(htmlBody) ? "" : brandHeader}
${htmlBody}
<p style="margin-top:32px;font-size:12px;color:#888;">
  You're receiving this because you're in our network.
  <a href="${unsubscribeUrl}">Unsubscribe</a>
</p>
<p style="margin-top:8px;font-size:11px;color:#aaa;">
  iCapOS — Powered by iCFO Capital Global, Inc.
</p>`;

  const textWithFooter = textBody
    ? `${textBody}\n\nTo unsubscribe: ${unsubscribeUrl}\n\niCapOS — Powered by iCFO Capital Global, Inc.`
    : undefined;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${input.from_name} <${input.from_email}>`,
        to: [input.to],
        reply_to: input.reply_to ?? undefined,
        subject,
        html: htmlWithFooter,
        text: textWithFooter,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { resend_id: null, ok: false, error: data?.message ?? "Resend error" };
    }
    return { resend_id: data.id ?? null, ok: true };
  } catch (err) {
    return { resend_id: null, ok: false, error: String(err) };
  }
}

function unsubscribeSecret(): string {
  return process.env.MARKETING_UNSUBSCRIBE_SECRET ?? "default-secret";
}

/**
 * HMAC-signed unsubscribe token. Format: `base64url(email).hexHmac`. The secret
 * is never placed in the payload (unlike the old scheme), so a recipient cannot
 * recover it or forge tokens for other addresses.
 */
export function makeUnsubscribeToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const enc = Buffer.from(normalized).toString("base64url");
  const sig = crypto.createHmac("sha256", unsubscribeSecret()).update(normalized).digest("hex").slice(0, 32);
  return `${enc}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    if (token.includes(".")) {
      // Current HMAC format.
      const [enc, sig] = token.split(".");
      if (!enc || !sig) return null;
      const email = Buffer.from(enc, "base64url").toString("utf8");
      const expected = crypto
        .createHmac("sha256", unsubscribeSecret())
        .update(email.trim().toLowerCase())
        .digest("hex")
        .slice(0, 32);
      if (sig.length !== expected.length) return null;
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
      return email;
    }

    // DEPRECATED legacy format base64url("email:secret") — kept so unsubscribe
    // links already sitting in inboxes keep working. Remove this branch (and
    // rotate MARKETING_UNSUBSCRIBE_SECRET) once old campaigns have aged out.
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const idx = decoded.lastIndexOf(":");
    if (idx === -1) return null;
    const email = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    if (sig !== unsubscribeSecret()) return null;
    return email;
  } catch {
    return null;
  }
}
