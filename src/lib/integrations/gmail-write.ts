// Gmail mutations: label actions (archive/spam/trash), reply-in-thread.
// Label/trash require gmail.modify; sending replies uses gmail.send.
// Permanent delete is intentionally NOT implemented (only reversible trash).

import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailAction = "archive" | "spam" | "notspam" | "trash" | "untrash" | "read" | "unread";

async function token(userId: string): Promise<string> {
  const t = await getValidGoogleAccessToken(userId);
  if ("error" in t) throw t.error;
  return t.accessToken;
}

async function post(accessToken: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return res.json().catch(() => ({}));
}

/** Apply a label/trash action to a whole thread. */
export async function applyGmailAction(userId: string, threadId: string, action: GmailAction): Promise<void> {
  const accessToken = await token(userId);
  switch (action) {
    case "trash": await post(accessToken, `/threads/${threadId}/trash`); return;
    case "untrash": await post(accessToken, `/threads/${threadId}/untrash`); return;
    case "archive": await post(accessToken, `/threads/${threadId}/modify`, { removeLabelIds: ["INBOX"] }); return;
    case "spam": await post(accessToken, `/threads/${threadId}/modify`, { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] }); return;
    case "notspam": await post(accessToken, `/threads/${threadId}/modify`, { removeLabelIds: ["SPAM"], addLabelIds: ["INBOX"] }); return;
    case "read": await post(accessToken, `/threads/${threadId}/modify`, { removeLabelIds: ["UNREAD"] }); return;
    case "unread": await post(accessToken, `/threads/${threadId}/modify`, { addLabelIds: ["UNREAD"] }); return;
  }
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function head(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}
function bareEmail(addr: string): string {
  return (addr.match(/<([^>]+)>/)?.[1] ?? addr).trim();
}

/** Reply within a Gmail thread (keeps threading via In-Reply-To/References). */
export async function replyGmailThread(userId: string, threadId: string, bodyText: string): Promise<void> {
  const accessToken = await token(userId);
  const res = await fetch(
    `${GMAIL_BASE}/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const thread = (await res.json()) as { messages?: Array<{ payload?: { headers?: Array<{ name: string; value: string }> } }> };
  const last = (thread.messages ?? [])[(thread.messages ?? []).length - 1];
  const headers = last?.payload?.headers;

  const to = bareEmail(head(headers, "Reply-To") || head(headers, "From"));
  if (!to) throw new Error("Could not determine the recipient.");
  const subjectRaw = head(headers, "Subject");
  const subject = /^re:/i.test(subjectRaw) ? subjectRaw : `Re: ${subjectRaw}`;
  const messageId = head(headers, "Message-ID");

  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    messageId ? `In-Reply-To: ${messageId}` : "",
    messageId ? `References: ${messageId}` : "",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    bodyText,
  ].filter(Boolean).join("\r\n");

  await post(accessToken, `/messages/send`, { raw: b64url(raw), threadId });
}
