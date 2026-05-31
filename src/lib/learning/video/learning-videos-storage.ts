import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const LEARNING_VIDEOS_BUCKET = "learning-videos";
export const LEARNING_VIDEO_MAX_BYTES = 250 * 1024 * 1024;
export const LEARNING_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);

export function extensionForVideoMime(mime: string) {
  if (mime === "video/webm") return "webm";
  return "mp4";
}

export function buildLearningVideoStoragePath(
  companyId: string,
  courseSlug: string,
  lessonSlug: string,
  fileName: string,
) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${companyId}/${courseSlug}/${lessonSlug}/${Date.now()}-${safeName}`;
}

export function isHttpVideoUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

export async function createLearningVideoSignedUrl(storagePath: string, expiresIn = 3600) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(LEARNING_VIDEOS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function resolveLessonVideoPlaybackUrl(
  videoUrl: string | null | undefined,
  renderStatus: string,
) {
  if (renderStatus !== "ready" || !videoUrl?.trim()) {
    return null;
  }

  if (isHttpVideoUrl(videoUrl)) {
    return videoUrl;
  }

  return createLearningVideoSignedUrl(videoUrl);
}

export async function deleteLearningVideoObject(storagePath: string) {
  const admin = createServiceRoleClient();
  await admin.storage.from(LEARNING_VIDEOS_BUCKET).remove([storagePath]);
}

export async function uploadLearningVideoFile(input: {
  companyId: string;
  storagePath: string;
  file: File;
  contentType: string;
}) {
  const supabase = await createServerSupabaseClient();
  const buffer = Buffer.from(await input.file.arrayBuffer());

  const { error } = await supabase.storage.from(LEARNING_VIDEOS_BUCKET).upload(input.storagePath, buffer, {
    contentType: input.contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}
