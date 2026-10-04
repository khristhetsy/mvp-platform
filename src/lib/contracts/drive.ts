// Save executed contracts to the countersigner's Google Drive. Uses the
// drive.file permission only: iCapOS sees and writes the folders and files it
// creates, never the rest of the Drive. Layout:
//   My Drive › iCapOS Contracts › <Company> › <files>

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { DRIVE_FILE_SCOPE } from "@/lib/integrations/google-oauth";

export const DRIVE_ROOT_FOLDER = "iCapOS Contracts";
const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink";
const FOLDER = "application/vnd.google-apps.folder";

export type DriveStatus = { configured: boolean; connected: boolean; canSave: boolean; email: string | null };

export async function driveStatus(userId: string): Promise<DriveStatus> {
  const s = await getGoogleConnectionStatus(createServiceRoleClient(), userId);
  return { configured: s.configured, connected: s.connected, canSave: s.connected && s.scopes.includes(DRIVE_FILE_SCOPE), email: s.email };
}

/** Folder name for a company: Drive allows most characters; keep it readable and bounded. */
export function companyFolderName(company: string | null | undefined): string {
  const name = (company ?? "").replace(/[\\/]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return name || "Other";
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function driveFetch(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ?? `Google Drive error ${res.status}`);
  return data;
}

async function folder(token: string, name: string, parent: string | null): Promise<string> {
  const where = [`name = '${q(name)}'`, `mimeType = '${FOLDER}'`, "trashed = false", parent ? `'${parent}' in parents` : "'root' in parents"].join(" and ");
  const found = await driveFetch(token, `${API}?q=${encodeURIComponent(where)}&fields=files(id)&pageSize=1&spaces=drive`);
  const id = (found.files as { id: string }[] | undefined)?.[0]?.id;
  if (id) return id;
  const made = await driveFetch(token, `${API}?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}) }),
  });
  return made.id as string;
}

async function upload(token: string, parent: string, name: string, bytes: Buffer): Promise<{ id: string; url: string | null }> {
  const boundary = `icapos${crypto.randomUUID().replace(/-/g, "")}`;
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent], mimeType: "application/pdf" })}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(head), bytes, Buffer.from(`\r\n--${boundary}--`)]);
  const data = await driveFetch(token, UPLOAD, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: new Uint8Array(body) });
  return { id: data.id as string, url: (data.webViewLink as string | undefined) ?? null };
}

/** Upload the files into iCapOS Contracts › <company>. Returns the folder link. */
export async function saveToDrive(userId: string, input: { company: string | null; files: { name: string; bytes: Buffer }[] }) {
  const auth = await getValidGoogleAccessToken(userId);
  if ("error" in auth && auth.error) throw auth.error;
  const token = (auth as { accessToken: string }).accessToken;
  const root = await folder(token, DRIVE_ROOT_FOLDER, null);
  const folderName = companyFolderName(input.company);
  const target = await folder(token, folderName, root);
  const files = [];
  for (const f of input.files) files.push(await upload(token, target, f.name, f.bytes));
  return { folderUrl: `https://drive.google.com/drive/folders/${target}`, path: `${DRIVE_ROOT_FOLDER} › ${folderName}`, files };
}
