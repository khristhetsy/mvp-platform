/** Phase 2: ElevenLabs narration — requires ELEVENLABS_API_KEY */
export function isElevenLabsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export async function synthesizeNarrationPlaceholder(_input: {
  narrationText: string;
  lessonSlug: string;
}): Promise<{ audioUrl: string | null; error?: string }> {
  if (!isElevenLabsConfigured()) {
    return { audioUrl: null, error: "ELEVENLABS_API_KEY not configured." };
  }
  return { audioUrl: null, error: "ElevenLabs integration not enabled in Phase 1." };
}
