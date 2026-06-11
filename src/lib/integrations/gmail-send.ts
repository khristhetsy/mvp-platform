import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

/** Encode a plain-text email as base64url RFC 2822 for the Gmail API. */
function encodeRawEmail(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message).toString("base64url");
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
  subject: string;
  body: string;
}): Promise<GmailSendResult> {
  const tokenResult = await getValidGoogleAccessToken(input.userId);
  if ("error" in tokenResult || !tokenResult.accessToken) {
    return { error: tokenResult.error ?? new Error("No Gmail access token available.") };
  }

  const raw = encodeRawEmail(input.to, input.subject, input.body);

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
