// Storage for recorded session video. Private bucket; playback via signed URLs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const EVENT_SESSION_VIDEO_BUCKET = "event-session-videos";
export const SESSION_VIDEO_MAX_BYTES = 500 * 1024 * 1024; // 500 MB
export const SESSION_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];

/** Object path: <eventId>/<sessionId>/<timestamp>-<sanitized name> */
export function buildSessionVideoPath(eventId: string, sessionId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${eventId}/${sessionId}/${Date.now()}-${safe}`;
}

export async function uploadSessionVideo(input: {
  supabase: SupabaseClient;
  path: string;
  bytes: ArrayBuffer | Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  const { error } = await input.supabase.storage
    .from(EVENT_SESSION_VIDEO_BUCKET)
    .upload(input.path, input.bytes, { contentType: input.contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

/** Short-lived signed playback URL. Best-effort — returns null on failure. */
export async function sessionVideoSignedUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.storage
      .from(EVENT_SESSION_VIDEO_BUCKET)
      .createSignedUrl(path, expiresIn);
    return error ? null : data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
