import { describe, expect, it } from "vitest";
import {
  buildReviewPack,
  COUNSEL_REVIEW_REQUIRED,
  currentReviewHash,
  reviewAllowsCoach,
  reviewFingerprint,
  reviewState,
  reviewedEnabledCourses,
} from "./review-pack";
import { OUTREACH_PLAYBOOK, OUTREACH_PLAYBOOK_SLUG } from "@/lib/learning/outreach-playbook";
import { COACH_TONES } from "./tones";

describe("review pack", () => {
  it("covers the course, every style, every reminder, the email footer and the AI rules", () => {
    const pack = buildReviewPack(OUTREACH_PLAYBOOK);
    expect(pack.course.slug).toBe(OUTREACH_PLAYBOOK_SLUG);
    expect(pack.styles).toHaveLength(COACH_TONES.length);
    expect(pack.reminders).toHaveLength(COACH_TONES.length * 3);
    expect(pack.aiRules).toHaveLength(COACH_TONES.length);
    expect(pack.emailFooter.join(" ")).toMatch(/not a broker-dealer/i);
    expect(pack.disclaimer).toMatch(/not legal, tax, investment, securities/i);
  });

  it("gives the same fingerprint every time and a new one when any word changes", () => {
    const a = reviewFingerprint(buildReviewPack(OUTREACH_PLAYBOOK));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(reviewFingerprint(buildReviewPack(OUTREACH_PLAYBOOK))).toBe(a);

    const edited = structuredClone(OUTREACH_PLAYBOOK);
    edited.sections[0].lessons[0].steps![0].instruction += " ";
    expect(reviewFingerprint(buildReviewPack(edited))).not.toBe(a);
  });

  it("knows the playbook and nothing else", () => {
    expect(currentReviewHash(OUTREACH_PLAYBOOK_SLUG)).toMatch(/^[0-9a-f]{64}$/);
    expect(currentReviewHash("some-other-course")).toBeNull();
  });
});

describe("review state when review is required", () => {
  const current = "abc";
  it("is not reviewed with no recorded hash", () => {
    expect(reviewState({ currentHash: current, reviewedHash: null, required: true })).toBe("not_reviewed");
    expect(reviewState({ currentHash: current, reviewedHash: undefined, required: true })).toBe("not_reviewed");
  });
  it("is reviewed only when the hashes match", () => {
    expect(reviewState({ currentHash: current, reviewedHash: "abc", required: true })).toBe("reviewed");
    expect(reviewState({ currentHash: current, reviewedHash: "old", required: true })).toBe("changed");
  });
  it("never counts a course that has no fingerprint", () => {
    expect(reviewState({ currentHash: null, reviewedHash: "abc", required: true })).toBe("changed");
  });
});

describe("review state when review is not required", () => {
  it("ships with review not required, because the course is education only", () => {
    expect(COUNSEL_REVIEW_REQUIRED).toBe(false);
    expect(reviewState({ currentHash: "abc", reviewedHash: null })).toBe("waived");
  });
  it("waives the review for a coach format course whatever was recorded", () => {
    for (const reviewedHash of [null, "abc", "old"]) {
      expect(reviewState({ currentHash: "abc", reviewedHash, required: false })).toBe("waived");
    }
  });
  it("still never counts a course that has no fingerprint", () => {
    expect(reviewState({ currentHash: null, reviewedHash: "abc", required: false })).toBe("not_reviewed");
  });
  it("lets the coach run only for reviewed or waived", () => {
    expect(reviewAllowsCoach("reviewed")).toBe(true);
    expect(reviewAllowsCoach("waived")).toBe(true);
    expect(reviewAllowsCoach("not_reviewed")).toBe(false);
    expect(reviewAllowsCoach("changed")).toBe(false);
  });
});

describe("enabled courses that count", () => {
  it("when review is required, keeps only courses whose current wording was reviewed", () => {
    const hash = currentReviewHash(OUTREACH_PLAYBOOK_SLUG)!;
    expect(reviewedEnabledCourses([{ course_key: OUTREACH_PLAYBOOK_SLUG, reviewed_hash: hash }], true)).toEqual([OUTREACH_PLAYBOOK_SLUG]);
    expect(reviewedEnabledCourses([{ course_key: OUTREACH_PLAYBOOK_SLUG, reviewed_hash: "stale" }], true)).toEqual([]);
    expect(reviewedEnabledCourses([{ course_key: OUTREACH_PLAYBOOK_SLUG, reviewed_hash: null }], true)).toEqual([]);
    expect(reviewedEnabledCourses([{ course_key: "other", reviewed_hash: hash }], true)).toEqual([]);
  });
  it("when review is not required, counts every enabled coach format course and nothing else", () => {
    expect(reviewedEnabledCourses([{ course_key: OUTREACH_PLAYBOOK_SLUG, reviewed_hash: null }])).toEqual([OUTREACH_PLAYBOOK_SLUG]);
    expect(reviewedEnabledCourses([{ course_key: "other", reviewed_hash: null }])).toEqual([]);
  });
});
