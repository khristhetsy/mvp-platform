import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { buildRawMessage, type GmailAttachment } from "@/lib/integrations/gmail-send";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

/** drafts.create/update/delete need gmail.modify OR gmail.compose. */
export function hasGmailDraftScope(scopes: string[]): boolean {
  return scopes.includes(GMAIL_MODIFY_SCOPE) || scopes.includes(GMAIL_COMPOSE_SCOPE);
}

// ── Pure MIME parsing (no network — unit-tested) ───────────────────────────────

type GmailHeader = { name: string; value: string };
export type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};

export type ParsedDraftAttachment = { name: string; mimeType: string; attachmentId: string; size: number };
export type ParsedDraft = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  attachments: ParsedDraftAttachment[];
};

export function decodeB64Url(data: string | undefined | null): string {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf-8");
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  const h = (headers ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

/** Walk a Gmail message payload into flat compose fields + attachment references. */
export function parseDraftMessage(payload: GmailPart | undefined): ParsedDraft {
  const headers = payload?.headers;
  let bodyText = "";
  let bodyHtml: string | null = null;
  const attachments: ParsedDraftAttachment[] = [];

  const walk = (part: GmailPart | undefined) => {
    if (!part) return;
    const mime = (part.mimeType ?? "").toLowerCase();
    const isAttachment = Boolean(part.filename && part.filename.trim()) && Boolean(part.body?.attachmentId);
    if (isAttachment) {
      attachments.push({
        name: part.filename as string,
        mimeType: part.mimeType || "application/octet-stream",
        attachmentId: part.body!.attachmentId as string,
        size: part.body?.size ?? 0,
      });
      return;
    }
    if (mime === "text/plain" && part.body?.data && !bodyText) {
      bodyText = decodeB64Url(part.body.data);
    } else if (mime === "text/html" && part.body?.data && bodyHtml === null) {
      bodyHtml = decodeB64Url(part.body.data);
    }
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);

  return {
    to: headerValue(headers, "To").replace(/undisclosed-recipients:;?/i, "").trim(),
    cc: headerValue(headers, "Cc"),
    bcc: headerValue(headers, "Bcc"),
    subject: headerValue(headers, "Subject"),
    bodyText,
    bodyHtml,
    attachments,
  };
}

/** First recipient / subject for a list row, without downloading the full body. */
export function draftSummaryFromHeaders(headers: GmailHeader[] | undefined): { to: string; subject: string } {
  return {
    to: headerValue(headers, "To").replace(/undisclosed-recipients:;?/i, "").trim(),
    subject: headerValue(headers, "Subject"),
  };
}

// ── Network operations ─────────────────────────────────────────────────────────

async function authHeader(userId: string): Promise<{ Authorization: string } | { error: Error }> {
  const t = await getValidGoogleAccessToken(userId);
  if ("error" in t || !t.accessToken) return { error: t.error ?? new Error("No Gmail access token available.") };
  return { Authorization: `Bearer ${t.accessToken}` };
}

export type DraftMessageInput = {
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  body: string;
  html?: string | null;
  attachments?: GmailAttachment[];
};

export type GmailDraftResult = { id: string } | { error: Error };

/** Create a new Gmail draft; returns its draft id. */
export async function createGmailDraft(userId: string, msg: DraftMessageInput): Promise<GmailDraftResult> {
  const auth = await authHeader(userId);
  if ("error" in auth) return auth;
  const raw = buildRawMessage(msg.to, msg.subject, msg.body, msg.html, msg.attachments ?? [], msg.cc, msg.bcc);
  const res = await fetch(`${GMAIL_BASE}/drafts`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) return { error: new Error(`Gmail draft create failed (${res.status}): ${await res.text().catch(() => "")}`) };
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  return data?.id ? { id: data.id } : { error: new Error("Gmail draft create returned no id.") };
}

/** Update an existing Gmail draft in place (same id, no duplicate). */
export async function updateGmailDraft(userId: string, draftId: string, msg: DraftMessageInput): Promise<GmailDraftResult> {
  const auth = await authHeader(userId);
  if ("error" in auth) return auth;
  const raw = buildRawMessage(msg.to, msg.subject, msg.body, msg.html, msg.attachments ?? [], msg.cc, msg.bcc);
  const res = await fetch(`${GMAIL_BASE}/drafts/${encodeURIComponent(draftId)}`, {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  // A draft that was sent/deleted elsewhere 404s — surface so the caller can recreate.
  if (res.status === 404) return { error: new Error("draft_not_found") };
  if (!res.ok) return { error: new Error(`Gmail draft update failed (${res.status}): ${await res.text().catch(() => "")}`) };
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  return { id: data?.id ?? draftId };
}

export async function deleteGmailDraft(userId: string, draftId: string): Promise<{ ok: true } | { error: Error }> {
  const auth = await authHeader(userId);
  if ("error" in auth) return auth;
  const res = await fetch(`${GMAIL_BASE}/drafts/${encodeURIComponent(draftId)}`, { method: "DELETE", headers: auth });
  if (!res.ok && res.status !== 404) {
    return { error: new Error(`Gmail draft delete failed (${res.status}): ${await res.text().catch(() => "")}`) };
  }
  return { ok: true };
}

export type GmailDraftDetail = ParsedDraft & { draftId: string; messageId: string };

/** Fetch one draft, fully parsed for restoring into the composer. */
export async function getGmailDraft(userId: string, draftId: string): Promise<GmailDraftDetail | { error: Error }> {
  const auth = await authHeader(userId);
  if ("error" in auth) return auth;
  const res = await fetch(`${GMAIL_BASE}/drafts/${encodeURIComponent(draftId)}?format=full`, { headers: auth });
  if (!res.ok) return { error: new Error(`Gmail draft fetch failed (${res.status})`) };
  const data = (await res.json().catch(() => null)) as { id?: string; message?: { id?: string; payload?: GmailPart } } | null;
  const parsed = parseDraftMessage(data?.message?.payload);
  return { ...parsed, draftId: data?.id ?? draftId, messageId: data?.message?.id ?? "" };
}

export type GmailDraftSummary = {
  draftId: string;
  messageId: string;
  to: string;
  subject: string;
  snippet: string;
  lastSaved: string; // ISO
};

/** List drafts (newest first) with lightweight metadata for the Drafts folder. */
export async function listGmailDraftSummaries(userId: string, max = 25): Promise<GmailDraftSummary[] | { error: Error }> {
  const auth = await authHeader(userId);
  if ("error" in auth) return auth;
  const listRes = await fetch(`${GMAIL_BASE}/drafts?maxResults=${max}`, { headers: auth });
  if (!listRes.ok) return { error: new Error(`Gmail drafts list failed (${listRes.status})`) };
  const listData = (await listRes.json().catch(() => null)) as { drafts?: Array<{ id: string; message?: { id: string } }> } | null;
  const drafts = listData?.drafts ?? [];

  const summaries = await Promise.all(
    drafts.map(async (d): Promise<GmailDraftSummary | null> => {
      const msgId = d.message?.id;
      if (!msgId) return null;
      const metaRes = await fetch(
        `${GMAIL_BASE}/messages/${msgId}?format=metadata&metadataHeaders=To&metadataHeaders=Subject`,
        { headers: auth },
      );
      if (!metaRes.ok) return null;
      const meta = (await metaRes.json().catch(() => null)) as
        | { snippet?: string; internalDate?: string; payload?: { headers?: GmailHeader[] } }
        | null;
      const { to, subject } = draftSummaryFromHeaders(meta?.payload?.headers);
      const lastSaved = meta?.internalDate ? new Date(Number(meta.internalDate)).toISOString() : new Date().toISOString();
      return { draftId: d.id, messageId: msgId, to, subject, snippet: meta?.snippet ?? "", lastSaved };
    }),
  );

  return summaries
    .filter((s): s is GmailDraftSummary => s !== null)
    .sort((a, b) => b.lastSaved.localeCompare(a.lastSaved));
}

/** Download one attachment's bytes (for re-hydrating a restored draft's files). */
export async function fetchGmailAttachmentBytes(
  userId: string,
  messageId: string,
  attachmentId: string,
): Promise<Buffer | { error: Error }> {
  const auth = await authHeader(userId);
  if ("error" in auth) return auth;
  const res = await fetch(`${GMAIL_BASE}/messages/${messageId}/attachments/${attachmentId}`, { headers: auth });
  if (!res.ok) return { error: new Error(`Gmail attachment fetch failed (${res.status})`) };
  const data = (await res.json().catch(() => null)) as { data?: string } | null;
  return Buffer.from(data?.data ?? "", "base64url");
}
