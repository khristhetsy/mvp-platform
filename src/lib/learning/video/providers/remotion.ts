/** Phase 2: Remotion render pipeline — requires REMOTION_RENDER_WEBHOOK_URL */
export function isRemotionConfigured() {
  return Boolean(process.env.REMOTION_RENDER_WEBHOOK_URL?.trim());
}

export async function queueRemotionRenderPlaceholder(_input: {
  courseSlug: string;
  lessonSlug: string;
  slidesJson: unknown;
}): Promise<{ jobId: string | null; error?: string }> {
  if (!isRemotionConfigured()) {
    return { jobId: null, error: "REMOTION_RENDER_WEBHOOK_URL not configured." };
  }
  return { jobId: null, error: "Remotion render not enabled in Phase 1." };
}
