/**
 * PDF attachments on support messages. Files live in the private
 * `support-attachments` bucket and are only ever opened through a short-lived
 * signed link after an access check. PDF only, like every document upload on
 * iCapOS; the file's own bytes are checked, not just its name.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupportAttachment } from "@/lib/support/support";

export const SUPPORT_BUCKET = "support-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** True when the bytes start with the PDF signature "%PDF-". */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

export function safeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/[^\w.\- ()]/g, "").trim() || "attachment.pdf";
  return base.toLowerCase().endsWith(".pdf") ? base.slice(0, 120) : `${base.slice(0, 116)}.pdf`;
}

export async function uploadSupportPdf(requestId: string, file: File): Promise<SupportAttachment | { error: string }> {
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: "That file is over 10 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) return { error: "Only PDF files can be attached." };
  const name = safeFileName(file.name);
  const path = `${requestId}/${crypto.randomUUID()}.pdf`;
  const { error } = await db().storage.from(SUPPORT_BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (error) return { error: "Couldn't upload the file. Try again." };
  return { path, name, size: file.size };
}

export async function signedSupportUrl(path: string, name: string): Promise<string | null> {
  const { data, error } = await db().storage.from(SUPPORT_BUCKET).createSignedUrl(path, 60, { download: name });
  return error ? null : data?.signedUrl ?? null;
}
