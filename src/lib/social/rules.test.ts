import { describe, it, expect } from "vitest";
import { backoffMsFor, SOCIAL_RULES } from "./rules";

describe("backoffMsFor", () => {
  it("returns 1m, 5m, 25m for the three retries", () => {
    expect(backoffMsFor(1)).toBe(60_000);
    expect(backoffMsFor(2)).toBe(5 * 60_000);
    expect(backoffMsFor(3)).toBe(25 * 60_000);
  });
  it("returns null once retries are exhausted (→ failed)", () => {
    expect(backoffMsFor(4)).toBeNull();
    expect(backoffMsFor(0)).toBeNull();
  });
});

describe("SOCIAL_RULES v1", () => {
  it("requires approval and keeps auto-publish off", () => {
    expect(SOCIAL_RULES.approveBeforePublish).toBe(true);
    expect(SOCIAL_RULES.autoPublish).toBe(false);
  });
});
