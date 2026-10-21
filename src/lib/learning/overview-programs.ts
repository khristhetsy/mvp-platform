/**
 * Promo slides for the founder Learning overview banner.
 *
 * One list drives the banner: the coached course (only when the coach is active for the founder),
 * Capital readiness (always), then every published course from learning_programs, in the admin's
 * order. Publish a new course in the admin and it becomes a slide with no code change.
 *
 * Copy is educational. It never promises a funding outcome and invents no statistic: every figure
 * shown comes from the inputs.
 */
import type { CoachedCourseSummary } from "@/lib/learning/coach/program-summary";

export type PromoFact = { value: string; label: string };

export type PromoSlide = {
  id: string;
  eyebrow: string;
  badge: string;
  headline: string;
  blurb: string;
  facts: PromoFact[];
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  previewTitle: string;
  preview: { label: string; active?: boolean }[];
  imageUrl?: string | null;
};

export type PublishedCourseInput = {
  id: string;
  title: string;
  description: string;
  difficulty: string | null;
  readiness_focus: string | null;
  banner_image_url: string | null;
  /** Optional banner copy set by an admin. Empty values fall back to the course title and description. */
  promo_headline?: string | null;
  promo_blurb?: string | null;
  promo_cta_label?: string | null;
  /** False keeps a published course out of the banner. Missing means shown. */
  show_in_banner?: boolean | null;
};

export type BuildPromoInput = {
  coached: CoachedCourseSummary | null;
  coachedLessonTitles: string[];
  activeStage: string;
  activeStagePercent: number;
  activeStageLessonCount: number;
  stages: { label: string; subtitle: string; active: boolean }[];
  courses: PublishedCourseInput[];
  maxSlides?: number;
};

const DEFAULT_MAX_SLIDES = 5;
const BLURB_MAX = 150;

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function pick(text: string | null | undefined, fallback: string): string {
  const clean = text?.trim();
  return clean ? clean : fallback;
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function stageNumber(stageKey: string): string {
  return stageKey.replace("stage_", "");
}

export function buildPromoSlides(input: BuildPromoInput): PromoSlide[] {
  const slides: PromoSlide[] = [];

  if (input.coached) {
    const c = input.coached;
    const started = c.lessonsDone > 0;
    slides.push({
      id: "coached-course",
      eyebrow: "COACHED COURSE",
      badge: "Included in your plan",
      headline: started ? "Keep your investor outreach moving" : "Start your investor outreach today",
      blurb: started
        ? `Your next module is ready: ${c.nextLessonTitle}. About ${c.nextMinutes} min, with your AI IR Coach beside you.`
        : `Don't wait for the perfect list. Take your first step in about ${c.nextMinutes} minutes, with an AI IR Coach beside you.`,
      facts: [
        { value: String(c.lessonCount), label: "modules" },
        { value: `${c.totalMinutes} min`, label: "of lessons" },
        { value: "1 a week", label: "steady pace" },
      ],
      cta: { label: started ? "Continue with your coach" : "Get started today", href: c.href },
      previewTitle: "What you will learn",
      preview: input.coachedLessonTitles.map((label, i) => ({ label, active: i === Math.min(c.lessonsDone, input.coachedLessonTitles.length - 1) })),
    });
  }

  const n = stageNumber(input.activeStage);
  slides.push({
    id: "capital-readiness",
    eyebrow: "CAPITAL READINESS PROGRAM",
    badge: "Included in your plan",
    headline: `Don't stall at Stage ${n}. Get started now`,
    blurb: "Your next lesson is waiting. Finish a stage at 80% to unlock the next, and lift your Capital Readiness Rating as you go.",
    facts: [
      { value: String(input.stages.length), label: "stages" },
      { value: "80%", label: "to unlock the next" },
      { value: String(input.activeStageLessonCount), label: `lessons in Stage ${n}` },
    ],
    cta: { label: input.activeStagePercent > 0 ? `Resume Stage ${n}` : "Get started", href: `/founder/learning/stages/${input.activeStage}` },
    secondary: { label: "My AI learning plan", href: "/founder/learning/plan" },
    previewTitle: "Your stages",
    preview: input.stages.map((s) => ({ label: `${s.label}, ${s.subtitle}`, active: s.active })),
  });

  for (const course of input.courses) {
    if (course.show_in_banner === false) continue;
    const facts: PromoFact[] = [];
    if (course.difficulty) facts.push({ value: capitalize(course.difficulty), label: "level" });
    if (course.readiness_focus) facts.push({ value: `Stage ${stageNumber(course.readiness_focus)}`, label: "focus" });
    slides.push({
      id: `course-${course.id}`,
      eyebrow: "COURSE",
      badge: "Included in your plan",
      headline: pick(course.promo_headline, course.title),
      blurb: clip(pick(course.promo_blurb, course.description), BLURB_MAX),
      facts,
      cta: { label: pick(course.promo_cta_label, "Get started"), href: `/founder/learning/courses/${course.id}` },
      secondary: { label: "Browse all courses", href: "/founder/learning/courses" },
      previewTitle: "About this course",
      preview: [],
      imageUrl: course.banner_image_url,
    });
  }

  return slides.slice(0, input.maxSlides ?? DEFAULT_MAX_SLIDES);
}
