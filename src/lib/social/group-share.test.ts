import { describe, expect, it } from "vitest";
import {
  NETWORK_DEFAULTS, OPENERS, buildShareText, estimateMinutes, isFacebookGroupUrl, isGroupUrl, isLinkedInGroupUrl,
  normalizeGroupUrl, pacing, reviewTag, summarize,
} from "./group-share";

describe("group share helpers", () => {
  it("accepts Facebook group links only", () => {
    expect(isFacebookGroupUrl("https://www.facebook.com/groups/aifounders")).toBe(true);
    expect(isFacebookGroupUrl("https://facebook.com/groups/12345/?ref=share")).toBe(true);
    expect(isFacebookGroupUrl("https://www.facebook.com/icfo")).toBe(false);
    expect(isFacebookGroupUrl("https://example.com/groups/x")).toBe(false);
    expect(isFacebookGroupUrl("not a url")).toBe(false);
  });

  it("accepts LinkedIn group links only", () => {
    expect(isLinkedInGroupUrl("https://www.linkedin.com/groups/1234567/")).toBe(true);
    expect(isLinkedInGroupUrl("https://www.linkedin.com/company/icfo")).toBe(false);
    expect(isLinkedInGroupUrl("https://www.facebook.com/groups/abc")).toBe(false);
  });

  it("checks a link against its network", () => {
    expect(isGroupUrl("facebook", "https://www.facebook.com/groups/abc")).toBe(true);
    expect(isGroupUrl("linkedin", "https://www.facebook.com/groups/abc")).toBe(false);
    expect(isGroupUrl("linkedin", "https://www.linkedin.com/groups/99")).toBe(true);
  });

  it("normalizes a group link so duplicates match", () => {
    expect(normalizeGroupUrl("https://facebook.com/groups/12345/?ref=share")).toBe("https://www.facebook.com/groups/12345");
    expect(normalizeGroupUrl("https://linkedin.com/groups/99/?x=1", "linkedin")).toBe("https://www.linkedin.com/groups/99");
  });

  it("uses stricter defaults for LinkedIn", () => {
    expect(NETWORK_DEFAULTS.linkedin.wait).toBeGreaterThan(NETWORK_DEFAULTS.facebook.wait);
    expect(NETWORK_DEFAULTS.linkedin.cap).toBeLessThan(NETWORK_DEFAULTS.facebook.cap);
  });

  it("adds the link once and rotates openers", () => {
    const a = buildShareText("Hello founders", "https://icapos.com/fit", 0, true);
    expect(a).toBe("Hello founders\n\nhttps://icapos.com/fit");
    const b = buildShareText("Hello founders", "https://icapos.com/fit", 1, true);
    expect(b.startsWith(OPENERS[1])).toBe(true);
    expect(b.match(/icapos\.com\/fit/g)?.length).toBe(1);
    const c = buildShareText("See https://icapos.com/fit now", "https://icapos.com/fit", 0, false);
    expect(c.match(/icapos\.com\/fit/g)?.length).toBe(1);
  });

  it("paces by wait, cap and group rule", () => {
    const now = new Date("2026-11-17T10:00:00");
    const opened = (min: number) => ({ status: "posted" as const, opened_at: new Date(now.getTime() - min * 60_000).toISOString(), skip_days: [] });
    expect(pacing([], [], 5, 10, now).allowed).toBe(true);
    const wait = pacing([opened(2)], [], 5, 10, now);
    expect(wait.allowed).toBe(false);
    expect(wait.reason).toBe("wait");
    expect(wait.waitSeconds).toBeGreaterThan(0);
    expect(pacing([opened(6)], [], 5, 10, now).allowed).toBe(true);
    expect(pacing([opened(6), opened(7)], [], 5, 2, now).reason).toBe("cap");
    expect(pacing([], [now.getDay()], 5, 10, now).reason).toBe("rule");
  });

  it("summarizes and estimates", () => {
    expect(summarize([{ status: "posted" }, { status: "waiting" }, { status: "waiting" }]))
      .toEqual({ posted: 1, opened: 0, waiting: 2, skipped: 0, total: 3 });
    expect(estimateMinutes(4, 5)).toBe(15);
    expect(estimateMinutes(1, 5)).toBe(0);
  });

  it("tags groups only after 30 days or 3 posts", () => {
    const now = new Date("2026-12-20T00:00:00");
    expect(reviewTag({ posts: 1, firstPostAt: "2026-12-15T00:00:00", clicks: 0, signups: 0, meetings: 0 }, now)).toBeNull();
    expect(reviewTag({ posts: 3, firstPostAt: "2026-12-15T00:00:00", clicks: 0, signups: 0, meetings: 0 }, now)).toBe("drop");
    expect(reviewTag({ posts: 3, firstPostAt: "2026-12-15T00:00:00", clicks: 9, signups: 1, meetings: 0 }, now)).toBe("watch");
    expect(reviewTag({ posts: 3, firstPostAt: "2026-12-15T00:00:00", clicks: 9, signups: 0, meetings: 1 }, now)).toBe("keep");
    expect(reviewTag({ posts: 1, firstPostAt: "2026-10-01T00:00:00", clicks: 4, signups: 2, meetings: 0 }, now)).toBe("keep");
  });
});
