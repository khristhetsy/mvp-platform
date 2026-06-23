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

export type GmailFolder = "inbox" | "sent" | "all" | "spam" | "trash" | "drafts";

const GMAIL_FOLDERS: GmailFolder[] = ["inbox", "sent", "all", "spam", "trash", "drafts"];
export function isGmailFolder(v: string): v is GmailFolder {
  return (GMAIL_FOLDERS as string[]).includes(v);
}

/** messages.list query suffix for a folder (drafts handled separately). */
function folderQuery(folder: GmailFolder): string {
  switch (folder) {
    case "inbox": return "labelIds=INBOX";
    case "sent": return "labelIds=SENT";
    case "spam": return "labelIds=SPAM&includeSpamTrash=true";
    case "trash": return "labelIds=TRASH&includeSpamTrash=true";
    case "all": return ""; // all mail (excludes spam/trash by default)
    default: return "labelIds=INBOX";
  }
}

async function metaToItem(accessToken: string, ids: string[]): Promise<GmailListItem[]> {
  const metas = await Promise.all(
    ids.map((id) =>
      gmailGet<{ id: string; threadId: string; snippet: string; labelIds?: string[]; payload?: GmailPayload }>(
        accessToken,
        `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
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
      from: header(m.payload?.headers, "From") || header(m.payload?.headers, "To"),
      subject: header(m.payload?.headers, "Subject") || "(no subject)",
      date: header(m.payload?.headers, "Date"),
      snippet: m.snippet ?? "",
      unread: (m.labelIds ?? []).includes("UNREAD"),
    });
  }
  return items;
}

/** List a folder, deduped to one row per thread (most recent message). */
export async function listGmailThreads(
  userId: string,
  opts: { folder?: GmailFolder; max?: number } = {},
): Promise<GmailListItem[]> {
  const accessToken = await token(userId);
  const folder = opts.folder ?? "inbox";
  const max = opts.max ?? 25;

  if (folder === "drafts") {
    const list = await gmailGet<{ drafts?: Array<{ id: string; message?: { id: string } }> }>(accessToken, `/drafts?maxResults=${max}`);
    const ids = (list.drafts ?? []).map((d) => d.message?.id).filter((x): x is string => Boolean(x));
    if (ids.length === 0) return [];
    return metaToItem(accessToken, ids);
  }

  const q = folderQuery(folder);
  const list = await gmailGet<{ messages?: Array<{ id: string }> }>(accessToken, `/messages?maxResults=${max}${q ? `&${q}` : ""}`);
  const ids = (list.messages ?? []).map((m) => m.id);
  if (ids.length === 0) return [];
  return metaToItem(accessToken, ids);
}

export interface GmailFolderCounts {
  inbox: number; // unread threads in INBOX
  drafts: number; // total drafts
  spam: number; // total threads in SPAM
}

/**
 * Per-folder badge counts from the Gmail label metadata (one cheap call each).
 * Inbox = unread threads; drafts/spam = totals. Best-effort: any failure → 0s.
 */
export async function getGmailFolderCounts(userId: string): Promise<GmailFolderCounts> {
  const accessToken = await token(userId);
  type Label = { messagesTotal?: number; messagesUnread?: number; threadsTotal?: number; threadsUnread?: number };
  const get = (id: string) => gmailGet<Label>(accessToken, `/labels/${id}`).catch(() => null);

  const [inbox, draft, spam] = await Promise.all([get("INBOX"), get("DRAFT"), get("SPAM")]);
  return {
    inbox: inbox?.threadsUnread ?? 0,
    drafts: draft?.messagesTotal ?? 0,
    spam: spam?.threadsTotal ?? 0,
  };
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
