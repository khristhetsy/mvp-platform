/** Phase 2: HeyGen avatar video — requires HEYGEN_API_KEY */

export function isHeyGenConfigured() {
  return Boolean(process.env.HEYGEN_API_KEY?.trim());
}

export function getHeyGenProviderNextStep() {
  if (isHeyGenConfigured()) {
    return {
      configured: true,
      message:
        "HEYGEN_API_KEY is set. Connect the HeyGen render job in Phase 2 to populate lesson video_url when complete.",
    };
  }
  return {
    configured: false,
    message:
      "HEYGEN_API_KEY is required to enable HeyGen avatar video generation. Phase 1 does not call HeyGen APIs.",
  };
}

export async function queueHeyGenRenderPlaceholder(_input: {
  script: string;
  lessonSlug: string;
}): Promise<{ videoUrl: string | null; error?: string }> {
  const status = getHeyGenProviderNextStep();
  if (!status.configured) {
    return { videoUrl: null, error: status.message };
  }
  return { videoUrl: null, error: "HeyGen render is not connected in Phase 1." };
}
