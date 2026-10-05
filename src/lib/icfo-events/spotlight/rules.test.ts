import { describe, expect, it } from "vitest";
import {
  SPOTLIGHT_SLOT_SECONDS,
  checkSpotlightFile,
  formatClock,
  minutesBetween,
  parseYouTubeId,
  spotlightCapacity,
} from "./rules";

describe("spotlight capacity", () => {
  it("uses a 3:12 slot", () => {
    expect(SPOTLIGHT_SLOT_SECONDS).toBe(192);
  });
  it("fits 46 companies in 150 minutes and 75 in four hours", () => {
    expect(spotlightCapacity(150)).toBe(46);
    expect(spotlightCapacity(240)).toBe(75);
    expect(spotlightCapacity(60)).toBe(18);
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

describe("file checks", () => {
  it("passes a landscape 2:54 mp4", () => {
    const r = checkSpotlightFile({ type: "video/mp4", bytes: 120 * 1024 * 1024, seconds: 174, width: 1920, height: 1080 });
    expect(r.every((c) => c.ok)).toBe(true);
  });
  it("fails a long portrait clip", () => {
    const r = checkSpotlightFile({ type: "video/mp4", bytes: 10, seconds: 200, width: 1080, height: 1920 });
    expect(r.find((c) => c.id === "length")?.ok).toBe(false);
    expect(r.find((c) => c.id === "landscape")?.ok).toBe(false);
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

import { cleanCaptions } from "./rules";

describe("cleanCaptions", () => {
  it("strips srt numbering and timestamps", () => {
    const srt = "1\n00:00:00,000 --> 00:00:02,500\nHi, I'm Maria.\n\n2\n00:00:02,500 --> 00:00:05,000\nWe automate payables.\n";
    expect(cleanCaptions(srt)).toBe("Hi, I'm Maria. We automate payables.");
  });
  it("strips vtt headers, tags and sbv times", () => {
    const vtt = "WEBVTT\nKind: captions\nLanguage: en\n\n00:00.000 --> 00:02.000\n<c>Hello</c> investors\n";
    expect(cleanCaptions(vtt)).toBe("Hello investors");
    expect(cleanCaptions("0:00:00.000,0:00:02.000\nPlain words")).toBe("Plain words");
  });
});
