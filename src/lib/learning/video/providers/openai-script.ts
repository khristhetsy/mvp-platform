import OpenAI from "openai";
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
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `You create educational founder training video scripts for CapitalOS. Output valid JSON only with keys: script, narrationText, captions, slides.
slides is an array of { id, title, bulletPoints[], narrationCue, durationSeconds }.
COMPLIANCE: Educational only. No legal, tax, investment, securities, or fundraising advice. No funding guarantees or investor approval claims.
QUIZ: Never include quiz correct answers or "choose option A/B/C/D". Teach concepts only.
${input.isQuizLesson ? "This is a quiz review lesson — explain concepts to study, not answer keys." : ""}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          courseTitle: input.courseTitle,
          category: input.courseCategory,
          lessonTitle: input.lessonTitle,
          durationMinutes: input.durationMinutes,
          lessonContent: input.lessonContent,
          keyPoints: input.keyPoints,
          quizTopics: input.quizPromptsOnly ?? [],
        }),
      },
    ],
  });

  const parsed = parseJsonBlock(response.output_text ?? "{}");
  return {
    script: parsed.script,
    narrationText: parsed.narrationText,
    captions: parsed.captions,
    slides: parsed.slides,
    provider: "openai",
  };
}
