import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

const BANNER_BUCKET = "event-banners";

export const VALID_FOCAL = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top left",
  "top right",
  "bottom left",
  "bottom right",
] as const;
export type FocalPoint = (typeof VALID_FOCAL)[number];

export function buildBannerPath(eventId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  return `${eventId}/${Date.now()}-${safe}`;
}

export async function uploadEventBanner(
  supabase: SupabaseClient<Database>,
  path: string,
  bytes: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await raw(supabase).storage.from(BANNER_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Banner upload failed: ${error.message}`);
}

/** Public URL for a stored banner (the bucket is public). */
export function bannerPublicUrl(supabase: SupabaseClient<Database>, path: string | null): string | null {
  if (!path) return null;
  const { data } = raw(supabase).storage.from(BANNER_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export async function setEventCover(
  supabase: SupabaseClient<Database>,
  eventId: string,
  patch: { coverPath?: string | null; overlay?: number; focal?: string },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.coverPath !== undefined) update.cover_path = patch.coverPath;
  if (patch.overlay !== undefined) update.cover_overlay = Math.max(0, Math.min(90, Math.round(patch.overlay)));
  if (patch.focal !== undefined) {
    update.cover_focal = (VALID_FOCAL as readonly string[]).includes(patch.focal) ? patch.focal : "center";
  }
  if (Object.keys(update).length === 0) return;
  const { error } = await raw(supabase).from("events").update(update).eq("id", eventId);
  if (error) throw new Error(error.message);
}
