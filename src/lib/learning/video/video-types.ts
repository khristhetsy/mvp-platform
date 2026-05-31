export type VideoRenderStatus = "draft" | "script_ready" | "rendering" | "ready" | "failed";

export type VideoProvider = "manual" | "openai" | "remotion" | "elevenlabs" | "heygen";

export type VideoSlide = {
  id: string;
  title: string;
  bulletPoints: string[];
  narrationCue: string;
  durationSeconds: number;
};

export type VideoScriptBundle = {
  script: string;
  narrationText: string;
  captions: string;
  slides: VideoSlide[];
  provider: VideoProvider;
};

export type FounderLessonVideoAssetRecord = {
  id: string;
  founder_id: string;
  company_id: string;
  course_slug: string;
  lesson_slug: string;
  script: string | null;
  narration_text: string | null;
  captions: string | null;
  slides_json: VideoSlide[];
  video_url: string | null;
  render_status: VideoRenderStatus;
  provider: VideoProvider;
  created_at: string;
  updated_at: string;
};

export const VIDEO_LESSON_DISCLAIMER =
  "CapitalOS video lessons are educational only and do not constitute legal, tax, investment, securities, or fundraising advice.";
