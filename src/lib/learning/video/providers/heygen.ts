/** Phase 2: HeyGen avatar video — requires HEYGEN_API_KEY */
export function isHeyGenConfigured() {
  return Boolean(process.env.HEYGEN_API_KEY?.trim());
}

export async function queueHeyGenRenderPlaceholder(_input: {
  script: string;
  lessonSlug: string;
}): Promise<{ videoUrl: string | null; error?: string }> {
  if (!isHeyGenConfigured()) {
    return { videoUrl: null, error: "HEYGEN_API_KEY not configured." };
  }
  return { videoUrl: null, error: "HeyGen integration not enabled in Phase 1." };
}
