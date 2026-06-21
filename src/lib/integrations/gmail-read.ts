// Read the user's real Gmail via the Gmail API (gmail.readonly). Mirrors the
// auth pattern in gmail-send.ts (Bearer token from getValidGoogleAccessToken).

import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailListItem = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
};

export type GmailMessage = {
  id: string;
  from: string;
  to: string;
  date: string;
  subject: string;
  snippet: string;
  text: string | null;
  html: string | null;
};

export type GmailThread = { id: string; subject: string; messages: GmailMessage[] };

class GmailScopeError extends Error {
  constructor() { super("Gmail read access not granted. Reconnect Google to enable your inbox."); this.name = "GmailScopeError"; }
}
export { GmailScopeError };

async function token(userId: string): Promise<string> {
  const t = await getValidGoogleAccessToken(userId);
  if ("error" in t) throw t.error;
  return t.accessToken;
}

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL_BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 403) throw new GmailScopeError();
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return (await res.json()) as T;
}

function header(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBody(data: string | undefined): string {
  if (!data) return "";
  try { return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); } catch { return ""; }
}

type GmailPayload = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
  headers?: Array<{ name: string; value: string }>;
};

/** Walk the MIME tree collecting the first text/plain and text/html parts. */
function extractBodies(payload: GmailPayload | undefined): { text: string | null; html: string | null } {
  let text: string | null = null;
  let html: string | null = null;
  const walk = (p?: GmailPayload) => {
    if (!p) return;
    if (p.mimeType === "text/plain" && text === null) text = decodeBody(p.body?.data);
    else if (p.mimeType === "text/html" && html === null) html = decodeBody(p.body?.data);
    for (const part of p.parts ?? []) walk(part);
  };
  walk(payload);
  return { text, html };
}

/** Inbox/Sent list, deduped to one row per thread (most recent message). */
export async function listGmailThreads(
  userId: string,
  opts: { label?: "INBOX" | "SENT"; max?: number } = {},
): Promise<GmailListItem[]> {
  const accessToken = await token(userId);
  const label = opts.label ?? "INBOX";
  const max = opts.max ?? 25;

  const list = await gmailGet<{ messages?: Array<{ id: string }> }>(accessToken, `/messages?labelIds=${label}&maxResults=${max}`);
  const ids = (list.messages ?? []).map((m) => m.id);
  if (ids.length === 0) return [];

  const metas = await Promise.all(
    ids.map((id) =>
      gmailGet<{ id: string; threadId: string; snippet: string; labelIds?: string[]; payload?: GmailPayload }>(
        accessToken,
        `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      ).catch(() => null),
    ),
  );

  const seen = new Set<string>();
  const items: GmailListItem[] = [];
  for (const m of metas) {
    if (!m || seen.has(m.threadId)) continue;
    seen.add(m.threadId);
    items.push({
      id: m.id,
      threadId: m.threadId,
      from: header(m.payload?.headers, "From"),
      subject: header(m.payload?.headers, "Subject") || "(no subject)",
      date: header(m.payload?.headers, "Date"),
      snippet: m.snippet ?? "",
      unread: (m.labelIds ?? []).includes("UNREAD"),
    });
  }
  return items;
}

export async function getGmailThread(userId: string, threadId: string): Promise<GmailThread> {
  const accessToken = await token(userId);
  const data = await gmailGet<{ id: string; messages?: Array<{ id: string; snippet: string; payload?: GmailPayload }> }>(
    accessToken,
    `/threads/${threadId}?format=full`,
  );

  const messages: GmailMessage[] = (data.messages ?? []).map((m) => {
    const { text, html } = extractBodies(m.payload);
    return {
      id: m.id,
      from: header(m.payload?.headers, "From"),
      to: header(m.payload?.headers, "To"),
      date: header(m.payload?.headers, "Date"),
      subject: header(m.payload?.headers, "Subject"),
      snippet: m.snippet ?? "",
      text,
      html,
    };
  });

  return { id: data.id, subject: messages[0]?.subject ?? "(no subject)", messages };
}
