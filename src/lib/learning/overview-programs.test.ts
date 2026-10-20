import { describe, expect, it } from "vitest";
import type { CoachedCourseSummary } from "@/lib/learning/coach/program-summary";
import { buildPromoSlides, type BuildPromoInput, type PublishedCourseInput } from "@/lib/learning/overview-programs";

const coached: CoachedCourseSummary = {
  title: "Investor Outreach Playbook",
  lessonCount: 8,
  lessonsDone: 0,
  totalMinutes: 87,
  nextLessonSlug: "game-plan",
  nextLessonTitle: "Your outreach game plan",
  nextMinutes: 10,
  href: "/founder/learning/coach/investor-outreach-playbook/game-plan",
  line: "line",
};

function course(id: string, over: Partial<PublishedCourseInput> = {}): PublishedCourseInput {
  return { id, title: `Course ${id}`, description: "A course.", difficulty: "beginner", readiness_focus: "stage_1", banner_image_url: null, ...over };
}

function base(over: Partial<BuildPromoInput> = {}): BuildPromoInput {
  return {
    coached: null,
    coachedLessonTitles: [],
    activeStage: "stage_0",
    activeStagePercent: 50,
    activeStageLessonCount: 4,
    stages: [
      { label: "Stage 0 - Foundation", subtitle: "Pre-fundraise basics", active: true },
      { label: "Stage 1 - Seed Round", subtitle: "Early-stage fundraising", active: false },
    ],
    courses: [],
    ...over,
  };
}

describe("buildPromoSlides", () => {
  it("always leads with Capital readiness when the coach is not active", () => {
    const slides = buildPromoSlides(base());
    expect(slides.map((s) => s.id)).toEqual(["capital-readiness"]);
  });

  it("puts the coached course first when the coach is active", () => {
    const slides = buildPromoSlides(base({ coached, coachedLessonTitles: ["Your outreach game plan", "Matches"] }));
    expect(slides.map((s) => s.id)).toEqual(["coached-course", "capital-readiness"]);
    expect(slides[0].facts).toEqual([
      { value: "8", label: "modules" },
      { value: "87 min", label: "of lessons" },
      { value: "1 a week", label: "steady pace" },
    ]);
    expect(slides[0].cta.href).toBe(coached.href);
    expect(slides[0].cta.label).toBe("Get started today");
  });

  it("switches the coached copy once a module is done", () => {
    const slides = buildPromoSlides(base({ coached: { ...coached, lessonsDone: 2 }, coachedLessonTitles: ["a", "b", "c"] }));
    expect(slides[0].cta.label).toBe("Continue with your coach");
    expect(slides[0].preview.filter((p) => p.active)).toHaveLength(1);
    expect(slides[0].preview[2].active).toBe(true);
  });

  it("adds a slide for every published course, in order", () => {
    const slides = buildPromoSlides(base({ courses: [course("a"), course("b")] }));
    expect(slides.map((s) => s.id)).toEqual(["capital-readiness", "course-a", "course-b"]);
    expect(slides[1].cta.href).toBe("/founder/learning/courses/a");
    expect(slides[1].facts).toEqual([
      { value: "Beginner", label: "level" },
      { value: "Stage 1", label: "focus" },
    ]);
  });

  it("caps the banner at five slides by default", () => {
    const many = Array.from({ length: 10 }, (_, i) => course(String(i)));
    expect(buildPromoSlides(base({ coached, courses: many }))).toHaveLength(5);
    expect(buildPromoSlides(base({ courses: many, maxSlides: 3 }))).toHaveLength(3);
  });

  it("uses the active stage in the Capital readiness copy and link", () => {
    const slide = buildPromoSlides(base({ activeStage: "stage_2", activeStagePercent: 0 }))[0];
    expect(slide.headline).toBe("Don't stall at Stage 2. Get started now");
    expect(slide.cta).toEqual({ label: "Get started", href: "/founder/learning/stages/stage_2" });
  });

  it("clips long course descriptions", () => {
    const slide = buildPromoSlides(base({ courses: [course("x", { description: "word ".repeat(100) })] }))[1];
    expect(slide.blurb.length).toBeLessThanOrEqual(150);
  });
});
