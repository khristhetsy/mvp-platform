// Presenter headshots and company logos. Both live in the private
// event-presenter-headshots bucket and render through short-lived signed URLs.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const PRESENTER_IMAGE_BUCKET = "event-presenter-headshots";
// PNG and JPEG only: pdfkit cannot embed WebP or SVG in the printed booklet.
export const PRESENTER_IMAGE_MIME = ["image/png", "image/jpeg"];
export const PRESENTER_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export type PresenterImageKind = "headshot" | "logo";

const COLUMN: Record<PresenterImageKind, string> = { headshot: "headshot_path", logo: "company_logo_path" };

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Object path: <presenterId>/<kind>-<timestamp>-<sanitized name>. */
export function buildPresenterImagePath(presenterId: string, kind: PresenterImageKind, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${presenterId}/${kind}-${Date.now()}-${safe}`;
}

export async function uploadPresenterImage(
  supabase: SupabaseClient<Database>,
  path: string,
  bytes: ArrayBuffer | Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await raw(supabase).storage
    .from(PRESENTER_IMAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
}

/** Point the presenter at a stored file, or clear it with null. */
export async function setPresenterImagePath(
  supabase: SupabaseClient<Database>,
  presenterId: string,
  kind: PresenterImageKind,
  path: string | null,
): Promise<void> {
  const { error } = await raw(supabase)
    .from("event_presenters")
    .update({ [COLUMN[kind]]: path })
    .eq("id", presenterId);
  if (error) throw new Error(error.message);
}

/** Signed URL for a stored presenter image. Best effort: null on failure. */
export async function presenterImageSignedUrl(path: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  // Reused rows may carry an absolute URL rather than a bucket path.
  if (/^https?:\/\//i.test(path)) return path;
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.storage.from(PRESENTER_IMAGE_BUCKET).createSignedUrl(path, expiresIn);
    return error ? null : data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

