// Storage helpers for the admin-task-files private bucket. Server-side only —
// always called with the service-role client. Files are never public; preview
// and download go through short-lived signed URLs.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { STORAGE_BUCKET, type SourceFormat } from "./types";

/** Canonical object path for a (possibly converted) attachment. §5 path convention. */
export function attachmentPath(taskId: string, attachmentId: string, ext: string): string {
  return `${taskId}/${attachmentId}.${ext}`;
}

/** Path for the retained original when a file was converted to PDF. */
export function originalPath(taskId: string, attachmentId: string, ext: SourceFormat): string {
  return `${taskId}/${attachmentId}.source.${ext}`;
}

export async function uploadTaskFile(
  supabase: SupabaseClient<Database>,
  path: string,
  bytes: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

/** Short-lived signed URL for a private object (default 60s, per §4). */
export async function taskFileSignedUrl(
  supabase: SupabaseClient<Database>,
  path: string,
  expiresInSeconds = 60,
  disposition: "inline" | "attachment" = "inline",
  downloadName?: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds, disposition === "attachment" ? { download: downloadName ?? true } : undefined);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function removeTaskFiles(supabase: SupabaseClient<Database>, paths: string[]): Promise<void> {
  const clean = paths.filter(Boolean);
  if (clean.length === 0) return;
  await supabase.storage.from(STORAGE_BUCKET).remove(clean);
}
