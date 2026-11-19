import { describe, expect, it } from "vitest";
import { manualReviewStatus } from "./review";

describe("manualReviewStatus", () => {
  it("is not due on the review day", () => {
    const s = manualReviewStatus(new Date("2026-11-19T12:00:00Z"), "2026-11-19", 30);
    expect(s.due).toBe(false);
    expect(s.daysSince).toBe(0);
    expect(s.nextReview).toBe("2026-12-19");
  });

  it("is not due exactly 30 days later", () => {
    expect(manualReviewStatus(new Date("2026-12-19T00:00:00Z"), "2026-11-19", 30).due).toBe(false);
  });

  it("is due once more than 30 days have passed", () => {
    const s = manualReviewStatus(new Date("2026-12-20T00:00:00Z"), "2026-11-19", 30);
    expect(s.due).toBe(true);
    expect(s.daysSince).toBe(31);
  });
});
