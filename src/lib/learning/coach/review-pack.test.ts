import { describe, expect, it } from "vitest";
import {
  buildReviewPack,
  currentReviewHash,
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

describe("review state", () => {
  const current = "abc";
  it("is not reviewed with no recorded hash", () => {
    expect(reviewState({ currentHash: current, reviewedHash: null })).toBe("not_reviewed");
    expect(reviewState({ currentHash: current, reviewedHash: undefined })).toBe("not_reviewed");
  });
  it("is reviewed only when the hashes match", () => {
    expect(reviewState({ currentHash: current, reviewedHash: "abc" })).toBe("reviewed");
    expect(reviewState({ currentHash: current, reviewedHash: "old" })).toBe("changed");
  });
  it("never counts a course that has no fingerprint", () => {
    expect(reviewState({ currentHash: null, reviewedHash: "abc" })).toBe("changed");
  });
});

describe("enabled courses that count", () => {
  it("keeps only courses whose current wording was reviewed", () => {
    const hash = currentReviewHash(OUTREACH_PLAYBOOK_SLUG)!;
    expect(reviewedEnabledCourses([{ course_key: OUTREACH_PLAYBOOK_SLUG, reviewed_hash: hash }])).toEqual([OUTREACH_PLAYBOOK_SLUG]);
    expect(reviewedEnabledCourses([{ course_key: OUTREACH_PLAYBOOK_SLUG, reviewed_hash: "stale" }])).toEqual([]);
    expect(reviewedEnabledCourses([{ course_key: OUTREACH_PLAYBOOK_SLUG, reviewed_hash: null }])).toEqual([]);
    expect(reviewedEnabledCourses([{ course_key: "other", reviewed_hash: hash }])).toEqual([]);
  });
});
