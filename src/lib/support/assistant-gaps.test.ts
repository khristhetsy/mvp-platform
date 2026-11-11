import { describe, expect, it } from "vitest";
import { buildGaps, gapKey } from "./assistant-gaps";

const ev = (detail: string | null, created_at: string) => ({ detail, created_at });

describe("gapKey", () => {
  it("ignores case, punctuation and extra spaces", () => {
    expect(gapKey("  How do I CHANGE my email?? ")).toBe("how do i change my email");
  });
});

describe("buildGaps", () => {
  const events = [
    ev("How do I change my email?", "2026-11-01T10:00:00Z"),
    ev("how do i change my email", "2026-11-03T10:00:00Z"),
    ev("Why does my list show 3?", "2026-11-02T10:00:00Z"),
    ev(null, "2026-11-02T11:00:00Z"),
    ev("hi", "2026-11-02T12:00:00Z"),
  ];

  it("groups repeat questions and sorts by how often they were asked", () => {
    const gaps = buildGaps(events, [], []);
    expect(gaps.map((g) => g.count)).toEqual([2, 1]);
    expect(gaps[0].lastAskedAt).toBe("2026-11-03T10:00:00Z");
  });

  it("drops dismissed questions", () => {
    const gaps = buildGaps(events, [gapKey("How do I change my email?")], []);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].question).toBe("Why does my list show 3?");
  });

  it("drops a question a taught answer now covers", () => {
    const taught = [{ id: "1", question: "How do I change my email address?", answer: "Settings, Profile." }];
    const gaps = buildGaps(events, [], taught);
    expect(gaps.map((g) => g.question)).toEqual(["Why does my list show 3?"]);
  });

  it("skips empty and one word details", () => {
    expect(buildGaps([ev(null, "2026-11-01T00:00:00Z"), ev("ok", "2026-11-01T00:00:00Z")], [], [])).toEqual([]);
  });
});
