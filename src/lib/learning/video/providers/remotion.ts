/** Phase 2: Remotion render pipeline — requires REMOTION_RENDER_WEBHOOK_URL */

export function isRemotionConfigured() {
  return Boolean(process.env.REMOTION_RENDER_WEBHOOK_URL?.trim());
}

export function getRemotionProviderNextStep() {
  if (isRemotionConfigured()) {
    return {
      configured: true,
      message:
        "REMOTION_RENDER_WEBHOOK_URL is set. Wire the webhook handler in Phase 2 to produce MP4 files from slide JSON.",
    };
  }
  return {
    configured: false,
    message:
      "REMOTION_RENDER_WEBHOOK_URL is required to enable Remotion-based video rendering. Phase 1 does not call Remotion.",
  };
}

export async function queueRemotionRenderPlaceholder(_input: {
  courseSlug: string;
  lessonSlug: string;
  slidesJson: unknown;
}): Promise<{ jobId: string | null; error?: string }> {
  const status = getRemotionProviderNextStep();
  if (!status.configured) {
    return { jobId: null, error: status.message };
  }
  return { jobId: null, error: "Remotion render webhook is not connected in Phase 1." };
}
