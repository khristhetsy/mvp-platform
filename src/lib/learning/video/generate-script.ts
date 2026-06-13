import { isClaudeConfigured } from "@/lib/claude";
import type { Course, CourseLesson } from "@/lib/learning/course-types";
import { generateScriptWithOpenAI, type LessonScriptInput } from "@/lib/learning/video/providers/openai-script";
import type { VideoScriptBundle, VideoSlide } from "@/lib/learning/video/video-types";

const QUIZ_LEAK_PATTERN =
  /\b(correct answer|choose option [a-d]|pick [a-d]|the answer is [a-d]|option [a-d] is correct|answer key)\b/gi;

function stripQuizLeaks(text: string) {
  return text.replace(QUIZ_LEAK_PATTERN, "[concept review]");
}

function buildSlidesFromLesson(lesson: CourseLesson, courseTitle: string): VideoSlide[] {
  const points = lesson.keyPoints?.length ? lesson.keyPoints : [lesson.content.slice(0, 120)];
  const intro: VideoSlide = {
    id: "slide-1",
    title: lesson.title,
    bulletPoints: [`Course: ${courseTitle}`, `Estimated ${lesson.durationMinutes} minutes`],
    narrationCue: `Welcome to ${lesson.title}. This is educational founder training only.`,
    durationSeconds: 20,
  };
  const contentSlides = points.slice(0, 4).map((point, i) => ({
    id: `slide-${i + 2}`,
    title: `Key idea ${i + 1}`,
    bulletPoints: [point],
    narrationCue: point,
    durationSeconds: 25,
  }));
  const outro: VideoSlide = {
    id: `slide-${contentSlides.length + 2}`,
    title: "Apply on CapitalOS",
    bulletPoints: [
      "Update your profile and document room",
      "Complete the lesson quiz if applicable",
      "Mark the lesson complete when ready",
    ],
    narrationCue: "Apply these ideas in your CapitalOS workspace. This is not legal or investment advice.",
    durationSeconds: 15,
  };
  return [intro, ...contentSlides, outro];
}

function buildCaptionsFromSlides(slides: VideoSlide[]) {
  let cursor = 0;
  return slides
    .map((slide) => {
      const start = formatCaptionTime(cursor);
      cursor += slide.durationSeconds;
      const end = formatCaptionTime(cursor);
      return `${start} --> ${end}\n${slide.narrationCue}`;
    })
    .join("\n\n");
}

function formatCaptionTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function buildFallbackVideoScript(course: Course, lesson: CourseLesson): VideoScriptBundle {
  const slides = buildSlidesFromLesson(lesson, course.title);
  const script = stripQuizLeaks(
    [
      `Welcome to ${lesson.title}, part of ${course.title}.`,
      lesson.content,
      ...(lesson.keyPoints ?? []).map((p) => `Key point: ${p}`),
      "This CapitalOS video lesson is educational founder training for investor preparation — not legal, tax, investment, or securities advice.",
      lesson.type === "quiz"
        ? "Use the lesson quiz to check your understanding. Study the concepts rather than looking for answer keys."
        : "Pause to reflect and apply these ideas to your company materials.",
    ].join("\n\n"),
  );

  const narrationText = stripQuizLeaks(
    slides.map((s) => s.narrationCue).join(" "),
  );

  return {
    script,
    narrationText,
    captions: buildCaptionsFromSlides(slides),
    slides,
    provider: "manual",
  };
}

export function sanitizeVideoBundle(bundle: VideoScriptBundle): VideoScriptBundle {
  return {
    ...bundle,
    script: stripQuizLeaks(bundle.script),
    narrationText: stripQuizLeaks(bundle.narrationText),
    captions: stripQuizLeaks(bundle.captions),
    slides: bundle.slides.map((s) => ({
      ...s,
      narrationCue: stripQuizLeaks(s.narrationCue),
      bulletPoints: s.bulletPoints.map((b) => stripQuizLeaks(b)),
    })),
  };
}

export function buildLessonScriptInput(course: Course, lesson: CourseLesson): LessonScriptInput {
  return {
    courseTitle: course.title,
    courseCategory: course.category,
    lessonTitle: lesson.title,
    lessonContent: lesson.content,
    keyPoints: lesson.keyPoints ?? [],
    durationMinutes: lesson.durationMinutes,
    isQuizLesson: lesson.type === "quiz",
    quizPromptsOnly: lesson.quiz?.questions.map((q) => q.prompt) ?? [],
  };
}

export async function generateLessonVideoScript(
  course: Course,
  lesson: CourseLesson,
): Promise<VideoScriptBundle> {
  const input = buildLessonScriptInput(course, lesson);

  if (isClaudeConfigured()) {
    try {
      const bundle = await generateScriptWithOpenAI(input);
      return sanitizeVideoBundle(bundle);
    } catch {
      return buildFallbackVideoScript(course, lesson);
    }
  }

  return buildFallbackVideoScript(course, lesson);
}
