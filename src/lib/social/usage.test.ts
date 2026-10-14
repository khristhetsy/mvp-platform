import { describe, expect, it } from "vitest";
import { cycleBounds, limitState, postsThatFit, remainingPosts } from "@/lib/social/usage";

describe("cycleBounds", () => {
  it("resets 30 days after signup at 00:00 Pacific", () => {
    const signup = new Date("2026-09-22T18:00:00Z");
    const { start, resetAt } = cycleBounds(signup, new Date("2026-10-14T17:00:00Z"));
    expect(start.toISOString()).toBe("2026-09-22T07:00:00.000Z");
    expect(resetAt.toISOString()).toBe("2026-10-22T07:00:00.000Z");
  });

  it("rolls into the next cycle once the reset passes", () => {
    const signup = new Date("2026-09-22T18:00:00Z");
    const { start, resetAt } = cycleBounds(signup, new Date("2026-10-22T08:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-22T07:00:00.000Z");
    expect(resetAt.toISOString()).toBe("2026-11-21T08:00:00.000Z");
  });

  it("uses the Pacific calendar day, not UTC, for a late evening signup", () => {
    // 2026-09-23 03:00 UTC is still Sep 22 in Pacific time.
    const { start } = cycleBounds(new Date("2026-09-23T03:00:00Z"), new Date("2026-09-30T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-09-22T07:00:00.000Z");
  });
});

describe("limit state", () => {
  it("is off when the plan has no access", () => {
    expect(limitState(false, 10, 0)).toBe("off");
  });
  it("warns at 2 left and stops at the limit", () => {
    expect(limitState(true, 10, 7)).toBe("ok");
    expect(limitState(true, 10, 8)).toBe("warn");
    expect(limitState(true, 10, 10)).toBe("reached");
  });
  it("treats a null limit as unlimited", () => {
    expect(limitState(true, null, 5000)).toBe("ok");
    expect(remainingPosts(null, 5000)).toBeNull();
  });
  it("holds the overflow of a recurring series", () => {
    expect(postsThatFit(10, 7, 6)).toBe(3);
    expect(postsThatFit(10, 10, 1)).toBe(0);
    expect(postsThatFit(null, 99, 6)).toBe(6);
  });
});
