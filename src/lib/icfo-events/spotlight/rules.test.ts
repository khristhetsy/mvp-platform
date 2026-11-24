import { describe, expect, it } from "vitest";
import {
  SPOTLIGHT_BREAK_SECONDS,
  SPOTLIGHT_MAX_VIDEO_SECONDS,
  SPOTLIGHT_SLOT_SECONDS,
  checkPresentationFile,
  formatClock,
  minutesBetween,
  parseYouTubeId,
  spotlightCapacity,
} from "./rules";

describe("spotlight capacity", () => {
  it("uses a 1:05 slot: a 60 second pitch plus a 5 second break", () => {
    expect(SPOTLIGHT_MAX_VIDEO_SECONDS).toBe(60);
    expect(SPOTLIGHT_BREAK_SECONDS).toBe(5);
    expect(SPOTLIGHT_SLOT_SECONDS).toBe(65);
  });
  it("fits 55 companies in an hour and 138 in 150 minutes", () => {
    expect(spotlightCapacity(60)).toBe(55);
    expect(spotlightCapacity(150)).toBe(138);
  });
  it("returns 0 for no time", () => {
    expect(spotlightCapacity(0)).toBe(0);
    expect(spotlightCapacity(Number.NaN)).toBe(0);
  });
  it("measures minutes between timestamps", () => {
    expect(minutesBetween("2026-12-15T20:30:00Z", "2026-12-15T21:45:00Z")).toBe(75);
    expect(minutesBetween(null, "2026-12-15T21:45:00Z")).toBeNull();
  });
});

describe("presentation file checks", () => {
  it("passes an mp4 under 500 MB", () => {
    expect(checkPresentationFile({ type: "video/mp4", bytes: 120 * 1024 * 1024 }).every((c) => c.ok)).toBe(true);
  });
  it("fails a wrong type and an oversized file", () => {
    const r = checkPresentationFile({ type: "video/avi", bytes: 600 * 1024 * 1024 });
    expect(r.find((c) => c.id === "type")?.ok).toBe(false);
    expect(r.find((c) => c.id === "size")?.ok).toBe(false);
  });
  it("formats a clock", () => {
    expect(formatClock(174)).toBe("2:54");
    expect(formatClock(5)).toBe("0:05");
  });
});

describe("parseYouTubeId", () => {
  it("accepts ids and links", () => {
    expect(parseYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://studio.youtube.com/video/dQw4w9WgXcQ/edit")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("rejects anything else", () => {
    expect(parseYouTubeId("https://vimeo.com/123")).toBeNull();
    expect(parseYouTubeId("short")).toBeNull();
  });
});
