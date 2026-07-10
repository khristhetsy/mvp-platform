import { describe, it, expect } from "vitest";
import {
  availableSlots,
  computeOpenSlots,
  configFromSettings,
  expandWindows,
  offsetMinutesForTimeZone,
} from "./availability";
import type { AvailabilityConfig } from "./types";

const utcConfig = (rules: AvailabilityConfig["weeklyRules"]): AvailabilityConfig => ({
  weeklyRules: rules,
  slotMinutes: 30,
  bufferMinutes: 0,
  timezoneOffsetMinutes: 0,
});

describe("offsetMinutesForTimeZone", () => {
  it("returns 0 for UTC", () => {
    expect(offsetMinutesForTimeZone("UTC", new Date("2026-06-22T12:00:00Z"))).toBe(0);
  });
  it("returns +330 for Asia/Kolkata (no DST)", () => {
    expect(offsetMinutesForTimeZone("Asia/Kolkata", new Date("2026-06-22T12:00:00Z"))).toBe(330);
  });
  it("falls back to 0 for a bad zone", () => {
    expect(offsetMinutesForTimeZone("Not/AZone")).toBe(0);
  });
});

describe("expandWindows", () => {
  it("produces one window for a single matching weekday", () => {
    // 2026-06-22 is a Monday (weekday 1).
    const windows = expandWindows(
      new Date("2026-06-22T00:00:00Z"),
      new Date("2026-06-23T00:00:00Z"),
      utcConfig([{ weekday: 1, startMinute: 9 * 60, endMinute: 17 * 60 }]),
    );
    expect(windows).toHaveLength(1);
    expect(windows[0].start).toBe("2026-06-22T09:00:00.000Z");
    expect(windows[0].end).toBe("2026-06-22T17:00:00.000Z");
  });

  it("ignores non-matching weekdays", () => {
    const windows = expandWindows(
      new Date("2026-06-22T00:00:00Z"),
      new Date("2026-06-23T00:00:00Z"),
      utcConfig([{ weekday: 0, startMinute: 9 * 60, endMinute: 17 * 60 }]),
    );
    expect(windows).toHaveLength(0);
  });
});

describe("computeOpenSlots", () => {
  const windows = [{ start: "2026-06-22T09:00:00.000Z", end: "2026-06-22T11:00:00.000Z" }];
  const before = new Date("2026-06-20T00:00:00Z");

  it("slices a 2h window into four 30m slots", () => {
    const slots = computeOpenSlots(windows, [], { slotMinutes: 30, bufferMinutes: 0, now: before });
    expect(slots.map((s) => s.start)).toEqual([
      "2026-06-22T09:00:00.000Z",
      "2026-06-22T09:30:00.000Z",
      "2026-06-22T10:00:00.000Z",
      "2026-06-22T10:30:00.000Z",
    ]);
  });

  it("drops slots overlapping a busy interval", () => {
    const busy = [{ start: "2026-06-22T09:30:00.000Z", end: "2026-06-22T10:00:00.000Z" }];
    const slots = computeOpenSlots(windows, busy, { slotMinutes: 30, bufferMinutes: 0, now: before });
    expect(slots.map((s) => s.start)).toEqual([
      "2026-06-22T09:00:00.000Z",
      "2026-06-22T10:00:00.000Z",
      "2026-06-22T10:30:00.000Z",
    ]);
  });

  it("applies the buffer around busy intervals", () => {
    const busy = [{ start: "2026-06-22T09:30:00.000Z", end: "2026-06-22T10:00:00.000Z" }];
    const slots = computeOpenSlots(windows, busy, { slotMinutes: 30, bufferMinutes: 15, now: before });
    expect(slots.map((s) => s.start)).toEqual(["2026-06-22T10:30:00.000Z"]);
  });

  it("drops slots in the past", () => {
    const slots = computeOpenSlots(windows, [], {
      slotMinutes: 30,
      bufferMinutes: 0,
      now: new Date("2026-06-22T10:00:00Z"),
    });
    expect(slots.map((s) => s.start)).toEqual([
      "2026-06-22T10:00:00.000Z",
      "2026-06-22T10:30:00.000Z",
    ]);
  });
});

describe("availableSlots (end-to-end)", () => {
  it("expands rules and removes busy time", () => {
    const slots = availableSlots(
      new Date("2026-06-22T00:00:00Z"),
      new Date("2026-06-23T00:00:00Z"),
      { ...utcConfig([{ weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 }]), slotMinutes: 30 },
      [{ start: "2026-06-22T09:00:00.000Z", end: "2026-06-22T09:30:00.000Z" }],
      new Date("2026-06-20T00:00:00Z"),
    );
    expect(slots.map((s) => s.start)).toEqual(["2026-06-22T09:30:00.000Z"]);
  });
});

describe("configFromSettings", () => {
  const base = { timezone: "UTC", slotMinutes: 45, slotDurations: [30, 45, 60], bufferMinutes: 10, weeklyRules: [], meetingTitle: "", questions: [] };

  it("carries through settings and resolves the offset", () => {
    const cfg = configFromSettings(base, new Date("2026-06-22T12:00:00Z"));
    expect(cfg.slotMinutes).toBe(30); // first offered duration is the default
    expect(cfg.bufferMinutes).toBe(10);
    expect(cfg.timezoneOffsetMinutes).toBe(0);
  });

  it("uses a valid duration override", () => {
    const cfg = configFromSettings(base, new Date("2026-06-22T12:00:00Z"), 60);
    expect(cfg.slotMinutes).toBe(60);
  });

  it("ignores a duration not offered and falls back to the default", () => {
    const cfg = configFromSettings(base, new Date("2026-06-22T12:00:00Z"), 90);
    expect(cfg.slotMinutes).toBe(30);
  });

  it("falls back to slotMinutes when slotDurations is empty", () => {
    const cfg = configFromSettings({ ...base, slotDurations: [] }, new Date("2026-06-22T12:00:00Z"));
    expect(cfg.slotMinutes).toBe(45);
  });
});
