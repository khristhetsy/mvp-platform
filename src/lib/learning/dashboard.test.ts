import { describe, expect, it } from "vitest";
import { buildLearningDashboard, courseRecord, founderRecord, lessonRecord, recordRows } from "./dashboard";

const base = {
  coursesTotal: 11,
  coursesPublished: 11,
  coursesDraft: 0,
  pendingReview: 0,
  enrolledFounders: 4,
  lessonCompletions: 22,
  quizAttempts: 0,
  certificates: 0,
  coached: [],
};

describe("buildLearningDashboard", () => {
  it("flags lessons completed with no quiz attempted", () => {
    const d = buildLearningDashboard(base);
    expect(d.attention).toEqual([{ tone: "warn", text: "22 lessons are complete and no quiz has been attempted." }]);
    expect(d.publishedPercent).toBe(100);
  });

  it("raises review and draft items and uses singular wording", () => {
    const d = buildLearningDashboard({ ...base, lessonCompletions: 1, quizAttempts: 3, pendingReview: 1, coursesPublished: 9, coursesDraft: 1 });
    expect(d.attention.map((a) => a.text)).toEqual(["1 course is waiting for review.", "1 course is still in draft."]);
    expect(d.publishedPercent).toBe(82);
  });

  it("has no percent and nothing to attend to for an empty catalog", () => {
    const d = buildLearningDashboard({ ...base, coursesTotal: 0, coursesPublished: 0, lessonCompletions: 0 });
    expect(d.publishedPercent).toBeNull();
    expect(d.attention).toEqual([]);
  });

  it("passes records through and defaults to none", () => {
    expect(buildLearningDashboard(base).records.courses).toEqual([]);
    const c = courseRecord({ id: "abc", title: "Training", content_status: "published" });
    expect(buildLearningDashboard({ ...base, records: { courses: [c], lessons: [], founders: [], quizzes: [], certificates: [] } }).records.courses[0]).toEqual({
      title: "Training",
      sub: "published",
      href: "/admin/learning/courses/abc",
      hrefLabel: "Open course",
    });
  });
});

describe("record shaping", () => {
  it("names the module and the founder on a lesson record", () => {
    const r = lessonRecord({ module_slug: "cs0-cap-table-101", lesson_id: "ct-dilution", completed_at: "2026-10-20T10:00:00Z" }, "Jane Founder");
    expect(r.title).toBe("Cap table 101, ct-dilution");
    expect(r.sub).toBe("Jane Founder, completed Oct 20");
    expect(r.href).toBe("/admin/learning/founders");
  });

  it("falls back when a founder has no name", () => {
    expect(founderRecord({ percent_complete: null }, undefined, 2)).toMatchObject({ title: "Enrolled founder 3", sub: "Name not on file, 0% complete" });
    expect(lessonRecord({ module_slug: "x", lesson_id: "y", completed_at: null }, undefined).sub).toBe("Name not on file, completed no date");
  });
});

describe("recordRows", () => {
  it("links each record and shows a placeholder when there are none", () => {
    expect(recordRows([{ title: "Training", sub: "published", href: "/admin/learning/courses/a", hrefLabel: "Open course" }])).toEqual([
      { label: "Training", value: "published", href: "/admin/learning/courses/a", hrefLabel: "Open course" },
    ]);
    expect(recordRows([], "No drafts.")).toEqual([{ label: "No drafts.", value: "" }]);
  });
});
