// One render engine for every PDF the contract feature produces: the editor's
// true preview, the PDF download, the e-signature copy and (through sealing)
// the executed copy all come from this converter, so they cannot differ.
//
// Google Docs: the filled .docx is uploaded to the sender's own Google Drive as
// a Google Doc, exported as PDF, and deleted at once. It runs through the
// Google account the staff member already connected to iCapOS (Gmail and
// Calendar), with the drive.file permission, which reaches only files iCapOS
// itself creates. No other service or key.
//
// Measured against Word's own PDF of the Convertible Note master (Oct 3, 2026):
// same page count (6), same fonts, 93% of lines broken at the same word.

import { getGoogleConnectedAccountForUser } from "@/lib/integrations/connected-accounts";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { isGoogleOAuthConfigured } from "@/lib/integrations/google-env";
import { DRIVE_FILE_SCOPE } from "@/lib/integrations/google-oauth";

const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";
const FILES = "https://www.googleapis.com/drive/v3/files";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TIMEOUT_MS = 90_000;

/** Where staff connect or reconnect Google. */
export const CONNECT_GOOGLE_HREF = "/api/integrations/google/connect?returnTo=/admin/integrations";

export class RenderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderUnavailableError";
  }
}

export class RenderFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderFailedError";
  }
}

export type RenderStatus = { ready: true } | { ready: false; message: string };

/** Whether this staff member can render: Google connected with the Drive file permission. */
export async function renderStatus(userId: string): Promise<RenderStatus> {
  if (!isGoogleOAuthConfigured()) return { ready: false, message: "Google sign in is not configured for iCapOS, so contract PDFs cannot be made." };
  const account = await getGoogleConnectedAccountForUser(userId);
  if (account.error || !account.data) return { ready: false, message: "Connect your Google account to make contract PDFs (Preview, PDF and Send)." };
  const scopes = (account.data.scopes ?? []) as string[];
  if (!scopes.includes(DRIVE_FILE_SCOPE)) return { ready: false, message: "Reconnect your Google account once to allow contract PDFs (Preview, PDF and Send)." };
  return { ready: true };
}

function multipart(meta: object, docx: Buffer): { body: Buffer; type: string } {
  const boundary = `icapos${crypto.randomUUID().replace(/-/g, "")}`;
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  return { body: Buffer.concat([Buffer.from(head, "utf8"), docx, Buffer.from(tail, "utf8")]), type: `multipart/related; boundary=${boundary}` };
}

async function driveError(res: Response, what: string): Promise<Error> {
  const j = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[] } } | null;
  const reason = j?.error?.errors?.[0]?.reason ?? "";
  if (res.status === 401 || reason === "insufficientPermissions" || reason === "authError") {
    return new RenderUnavailableError("Reconnect your Google account once to allow contract PDFs (Preview, PDF and Send).");
  }
  if (reason === "accessNotConfigured" || /has not been used|is disabled/i.test(j?.error?.message ?? "")) {
    return new RenderFailedError("The Google Drive API is not enabled for iCapOS's Google Cloud project. Enable it, then try again.");
  }
  return new RenderFailedError(`${what} (${res.status}${j?.error?.message ? `: ${j.error.message}` : ""}).`);
}

/** Word file → PDF through Google Docs, using `userId`'s connected Google account. */
export async function docxToPdf(docx: Buffer, filename: string, userId: string): Promise<Buffer> {
  const status = await renderStatus(userId);
  if (!status.ready) throw new RenderUnavailableError(status.message);
  const token = await getValidGoogleAccessToken(userId);
  if ("error" in token || !token.accessToken) throw new RenderUnavailableError("Reconnect your Google account to make contract PDFs.");
  const auth = { Authorization: `Bearer ${token.accessToken}` };

  const name = `iCapOS render ${filename.replace(/\.docx$/i, "")} ${crypto.randomUUID().slice(0, 8)}`;
  const { body, type } = multipart({ name, mimeType: "application/vnd.google-apps.document" }, docx);
  const up = await fetch(UPLOAD, { method: "POST", headers: { ...auth, "Content-Type": type }, body: new Uint8Array(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!up.ok) throw await driveError(up, "Google could not open the document");
  const id = ((await up.json()) as { id?: string }).id;
  if (!id) throw new RenderFailedError("Google did not return the uploaded document.");

  try {
    const pdf = await fetch(`${FILES}/${encodeURIComponent(id)}/export?mimeType=application/pdf`, { headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!pdf.ok) throw await driveError(pdf, "Google could not make the PDF");
    const bytes = Buffer.from(await pdf.arrayBuffer());
    if (bytes.subarray(0, 4).toString() !== "%PDF") throw new RenderFailedError("Google returned something that is not a PDF.");
    return bytes;
  } finally {
    // The PDF is kept in iCapOS storage; never leave a copy in the sender's Drive.
    await fetch(`${FILES}/${encodeURIComponent(id)}`, { method: "DELETE", headers: auth }).catch(() => null);
  }
}
