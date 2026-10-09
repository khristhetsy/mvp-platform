import crypto from "crypto";
import type { SendResult } from "./types";

import { absolutizeEmailHtml } from "@/lib/email/absolutize-html";
import { logOutboundEmail } from "@/lib/email/email-log";
import { firstValidEmail } from "./recipient";
import { SAMPLE_CRR, usesCrrTokens } from "./crr-merge";

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
  // CRR tokens are only filled when the caller resolved them; otherwise they are
  // left as written so a template never goes out with an empty "went from  to ".
  if (vars.starting_crr != null) add(["starting_crr", "start_crr"], vars.starting_crr);
  if (vars.current_crr != null) add(["current_crr"], vars.current_crr);
  if (vars.testimonial_url != null) add(["testimonial_url"], vars.testimonial_url);
  if (vars.unsubscribe_url != null) add(["unsubscribe_url", "unsubscribe_link", "preferences_url"], vars.unsubscribe_url);
  if (vars.logo_url != null) add(["logo_url"], vars.logo_url);
  if (vars.claim_url != null) add(["claim_url"], vars.claim_url);
  return text.replace(/\{\{?\s*([A-Za-z][\w ]*?)\s*\}?\}/g, (m, tok: string) => {
    const key = tok.trim().toLowerCase().replace(/\s+/g, "_");
    return key in known ? known[key] : m;
  });
}

/**
 * Merge fields still written as {{token}} after interpolation: tokens the sender
 * has no value for (for example {{match_count}} in a sequence template). Double
 * braces only, so ordinary text and CSS are never matched.
 */
export function unfilledMergeFields(...parts: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const m of part.matchAll(/\{\{\s*([A-Za-z][\w ]*?)\s*\}\}/g)) found.add(m[1].trim());
  }
  return [...found];
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
  /** Optional file attachments (base64 content), sent as real attachments. */
  attachments?: Array<{ filename: string; content: string }>;
  /** Extra headers (Match campaign threading: Message-ID, In-Reply-To, References). Unsubscribe headers always win. */
  headers?: Record<string, string>;
};

export async function sendMarketingEmail(
  input: SendMarketingEmailInput
): Promise<SendResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { resend_id: null, ok: false, error: "RESEND_API_KEY not configured" };
  }

  // Resolve a single deliverable address; skip locally (no Resend call) if none.
  const to = firstValidEmail(input.to);
  if (!to) {
    return { resend_id: null, ok: false, error: `Invalid recipient address: ${input.to}` };
  }

  const vars: Record<string, string> = {
    first_name: input.first_name ?? "there",
    company: input.company ?? "",
    email: to,
    sender_name: input.from_name ?? "",
  };

  // Templates that quote the founder's Capital Readiness Rating ({{starting_crr}},
  // {{current_crr}}) get the recipient's real scores. Recipients with no rising
  // CRR on record are skipped rather than sent a broken or awkward line. [TEST]
  // sends go to staff addresses, so they use sample scores instead.
  if (usesCrrTokens(input.subject, input.html_body, input.text_body)) {
    const isTest = /^\[TEST/i.test(input.subject);
    const { loadCrrChangeForEmail } = await import("./crr-merge-db");
    const crr = (await loadCrrChangeForEmail(to)) ?? (isTest ? SAMPLE_CRR : null);
    if (!crr) {
      return { resend_id: null, ok: false, error: `Skipped ${to}: no Capital Readiness Rating rise of 10+ points on record` };
    }
    vars.starting_crr = crr.starting_crr;
    vars.current_crr = crr.current_crr;
  }

  // Personal signed link to icapos.com/testimonial, only for templates that use it.
  if (/\{\{?\s*testimonial[ _]url\s*\}?\}/i.test(`${input.html_body}\n${input.text_body ?? ""}`)) {
    const { testimonialUrl } = await import("@/lib/testimonials/token");
    vars.testimonial_url = testimonialUrl(to);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${input.unsubscribe_token}`;
  // {{unsubscribe_url}} / {{preferences_url}} in a template get the real link,
  // {{logo_url}} the hosted email logo (the same one the branded header uses).
  vars.unsubscribe_url = unsubscribeUrl;
  const logoUrl = process.env.EMAIL_LOGO_URL ?? `${appUrl}/email-logo.png`;
  vars.logo_url = logoUrl;
  // Personal signed link to the free due diligence claim page (icapos.com/claim).
  if (/\{\{?\s*claim[ _]url\s*\}?\}/i.test(`${input.html_body}\n${input.text_body ?? ""}`)) {
    const { claimUrl } = await import("@/lib/listing/claim");
    vars.claim_url = claimUrl(to);
  }

  const subject = interpolate(input.subject, vars);
  // Strip HTML comments so template authoring notes (e.g. "<!-- to add more; delete to
  // remove … -->") never leak into the delivered email, then rewrite any relative
  // src/href to absolute — delivered mail has no base URL, so a relative logo path
  // renders as a broken image in the inbox.
  const htmlBody = absolutizeEmailHtml(stripHtmlComments(interpolate(input.html_body, vars)));
  // Always send a plain-text alternative — derive one from the HTML if none was
  // authored, or if the authored text still has a field the HTML doesn't need
  // (a plain-text {{cta_url}} beside a real link in the HTML). Missing text
  // parts are a real spam signal.
  const authoredText = input.text_body ? interpolate(input.text_body, vars) : null;
  const textBody = authoredText && unfilledMergeFields(authoredText).length === 0 ? authoredText : htmlToText(htmlBody);

  // Never send an email with a merge field left as written ("{{match_count}}
  // investors fit ..."). The send is refused with the field named, so it shows
  // as failed in the campaign or sequence log and the template can be fixed.
  const unfilled = unfilledMergeFields(subject, htmlBody, textBody);
  if (unfilled.length) {
    return {
      resend_id: null,
      ok: false,
      error: `Not sent: no value for ${unfilled.map((t) => `{{${t}}}`).join(", ")}. Fix the template or remove the field.`,
    };
  }

  // Branded header with an ABSOLUTE, hosted logo so it renders in delivered mail (not just
  // the editor). Point EMAIL_LOGO_URL at the CDN asset; falls back to an app-hosted path.
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
        to: [to],
        reply_to: input.reply_to ?? undefined,
        subject,
        html: htmlWithFooter,
        text: textWithFooter,
        headers: {
          ...(input.headers ?? {}),
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      await logOutboundEmail({ to, subject, status: "failed", error: data?.message ?? "Resend error", source: "marketing-campaign", storeBody: false });
      return { resend_id: null, ok: false, error: data?.message ?? "Resend error" };
    }
    // Campaign bodies stay in the campaign; the log keeps who got what and when.
    await logOutboundEmail({ to, subject, status: "sent", providerId: data.id ?? null, source: "marketing-campaign", storeBody: false });
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
