import { claudeComplete, CLAUDE_HAIKU } from "@/lib/claude";
import type { VideoScriptBundle, VideoSlide } from "@/lib/learning/video/video-types";

export type LessonScriptInput = {
  courseTitle: string;
  courseCategory: string;
  lessonTitle: string;
  lessonContent: string;
  keyPoints: string[];
  durationMinutes: number;
  isQuizLesson: boolean;
  quizPromptsOnly?: string[];
};

function parseJsonBlock(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw) as {
    script: string;
    narrationText: string;
    captions: string;
    slides: VideoSlide[];
  };
}

export async function generateScriptWithOpenAI(input: LessonScriptInput): Promise<VideoScriptBundle> {
  const system = `You create educational founder training video scripts for CapitalOS. Output valid JSON only with keys: script, narrationText, captions, slides.
slides is an array of { id, title, bulletPoints[], narrationCue, durationSeconds }.
COMPLIANCE: Educational only. No legal, tax, investment, securities, or fundraising advice. No funding guarantees or investor approval claims.
QUIZ: Never include quiz correct answers or "choose option A/B/C/D". Teach concepts only.
${input.isQuizLesson ? "This is a quiz review lesson — explain concepts to study, not answer keys." : ""}`;

  const userContent = JSON.stringify({
    courseTitle: input.courseTitle,
    category: input.courseCategory,
    lessonTitle: input.lessonTitle,
    durationMinutes: input.durationMinutes,
    lessonContent: input.lessonContent,
    keyPoints: input.keyPoints,
    quizTopics: input.quizPromptsOnly ?? [],
  });

  const raw = await claudeComplete(
    [{ role: "user", content: userContent }],
    { model: CLAUDE_HAIKU, maxTokens: 2048, system }
  );

  const parsed = parseJsonBlock(raw || "{}");
  return {
    script: parsed.script,
    narrationText: parsed.narrationText,
    captions: parsed.captions,
    slides: parsed.slides,
    provider: "claude",
  };
}
