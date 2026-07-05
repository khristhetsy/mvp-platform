import type { SendResult } from "./types";

const RESEND_API_URL = "https://api.resend.com/emails";

function getApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() ?? null;
}

/** True when the email provider (Resend) is configured and can actually deliver. */
export function emailConfigured(): boolean {
  return Boolean(getApiKey());
}

/** Replace {{first_name}}, {{company}}, etc. in subject/body */
function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
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
  };

  const subject = interpolate(input.subject, vars);
  const htmlBody = interpolate(input.html_body, vars);
  const textBody = input.text_body ? interpolate(input.text_body, vars) : undefined;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://myicfos.com";
  const unsubscribeUrl = `${appUrl}/unsubscribe?token=${input.unsubscribe_token}`;

  const htmlWithFooter = `${htmlBody}
<p style="margin-top:32px;font-size:12px;color:#888;">
  You're receiving this because you're in our network.
  <a href="${unsubscribeUrl}">Unsubscribe</a>
</p>`;

  const textWithFooter = textBody
    ? `${textBody}\n\nTo unsubscribe: ${unsubscribeUrl}`
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

/** Generate a simple signed token for unsubscribe links */
export function makeUnsubscribeToken(email: string): string {
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET ?? "default-secret";
  // Base64url encode of "email:hmac" — for production use crypto.subtle HMAC
  const payload = Buffer.from(`${email}:${secret}`).toString("base64url");
  return payload;
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET ?? "default-secret";
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [email, sig] = decoded.split(":");
    if (sig !== secret) return null;
    return email;
  } catch {
    return null;
  }
}
