import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export interface GmailAttachment {
  name: string;
  mimeType: string;
  content: Buffer;
}

/** base64 split into 76-char lines per RFC 2045. */
function b64lines(buf: Buffer): string {
  return buf.toString("base64").replace(/(.{76})/g, "$1\r\n");
}

function rand(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

/** A text/plain (and optionally text/html) body, as a multipart/alternative block or a single part. */
function bodyMime(body: string, html?: string | null): string {
  if (!html) {
    return [
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      b64lines(Buffer.from(body, "utf-8")),
    ].join("\r\n");
  }
  const alt = rand("alt");
  return [
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    `--${alt}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64lines(Buffer.from(body, "utf-8")),
    `--${alt}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64lines(Buffer.from(html, "utf-8")),
    `--${alt}--`,
  ].join("\r\n");
}

/** Encode an email (optionally with html + attachments) as base64url RFC 2822 for the Gmail API. */
function encodeRawEmail(to: string, subject: string, body: string, html?: string | null, attachments: GmailAttachment[] = [], cc?: string | null, bcc?: string | null): string {
  const recipientHeaders = [`To: ${to}`];
  if (cc && cc.trim()) recipientHeaders.push(`Cc: ${cc.trim()}`);
  if (bcc && bcc.trim()) recipientHeaders.push(`Bcc: ${bcc.trim()}`);

  if (attachments.length === 0) {
    const message = [
      ...recipientHeaders,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      bodyMime(body, html),
    ].join("\r\n");
    return Buffer.from(message).toString("base64url");
  }

  const boundary = rand("b");
  const parts: string[] = [
    ...recipientHeaders,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    bodyMime(body, html),
  ];
  for (const a of attachments) {
    const safe = a.name.replace(/"/g, "");
    parts.push(
      `--${boundary}`,
      `Content-Type: ${a.mimeType || "application/octet-stream"}; name="${safe}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${safe}"`,
      "",
      b64lines(a.content),
    );
  }
  parts.push(`--${boundary}--`, "");
  return Buffer.from(parts.join("\r\n")).toString("base64url");
}

export type GmailSendResult =
  | { success: true; messageId: string }
  | { error: Error };

/**
 * Send an email via the Gmail API using the connected Google account for `userId`.
 * The email appears to come from the user's own Gmail address.
 * Requires the gmail.send OAuth scope.
 */
export async function sendViaGmail(input: {
  userId: string;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  body: string;
  html?: string | null;
  attachments?: GmailAttachment[];
}): Promise<GmailSendResult> {
  const tokenResult = await getValidGoogleAccessToken(input.userId);
  if ("error" in tokenResult || !tokenResult.accessToken) {
    return { error: tokenResult.error ?? new Error("No Gmail access token available.") };
  }

  const raw = encodeRawEmail(input.to, input.subject, input.body, input.html, input.attachments ?? [], input.cc, input.bcc);

  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    return { error: new Error(`Gmail send failed (${response.status}): ${text}`) };
  }

  const data = (await response.json().catch(() => null)) as { id?: string } | null;
  return { success: true, messageId: data?.id ?? "unknown" };
}

/** Check if a scopes array includes the gmail.send scope. */
export function hasGmailSendScope(scopes: string[]): boolean {
  return scopes.includes(GMAIL_SEND_SCOPE);
}
