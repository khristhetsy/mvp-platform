import { describe, it, expect } from "vitest";
import { resolve } from "./resolve";
import { NOTIF_TYPES } from "./catalog";
import { isWithinQuietHours, parseCadence, isDailyDue, isWeeklyDue, windowKey } from "./cadence";

const settings = {
  quiet_hours_on: true,
  quiet_start: "21:00",
  quiet_end: "07:00",
  timezone: "UTC",
};

describe("resolve()", () => {
  it("falls back to catalog default when no pref row", () => {
    const t = NOTIF_TYPES.find((x) => x.id === "cmo.brief_ready")!;
    const r = resolve("cmo.brief_ready", undefined, true)!;
    expect(r.enabled).toBe(t.defaultOn);
    expect(r.channels).toEqual(t.defaultChannels);
    expect(r.cadence).toBe(t.defaultCadence);
  });

  it("master switch off disables everything regardless of pref", () => {
    const r = resolve("cmo.brief_ready", { type_id: "cmo.brief_ready", enabled: true, channels: ["in_app"], cadence: null }, false)!;
    expect(r.enabled).toBe(false);
  });

  it("pref row overrides catalog default", () => {
    const r = resolve("cmo.high_confidence", { type_id: "cmo.high_confidence", enabled: false, channels: ["email"], cadence: null }, true)!;
    expect(r.enabled).toBe(false);
    expect(r.channels).toEqual(["email"]);
  });

  it("returns null for unknown type", () => {
    expect(resolve("nope.nope", undefined, true)).toBeNull();
  });

  it("carries the urgent flag from the catalog", () => {
    expect(resolve("compliance.violation_flagged", undefined, true)!.urgent).toBe(true);
    expect(resolve("cmo.brief_ready", undefined, true)!.urgent).toBe(false);
  });
});

describe("quiet hours (wrap past midnight)", () => {
  it("is inside the window at 23:00 UTC", () => {
    expect(isWithinQuietHours(settings, new Date("2026-06-30T23:00:00Z"))).toBe(true);
  });
  it("is inside the window at 03:00 UTC", () => {
    expect(isWithinQuietHours(settings, new Date("2026-06-30T03:00:00Z"))).toBe(true);
  });
  it("is outside the window at 12:00 UTC", () => {
    expect(isWithinQuietHours(settings, new Date("2026-06-30T12:00:00Z"))).toBe(false);
  });
  it("is disabled when quiet_hours_on is false", () => {
    expect(isWithinQuietHours({ ...settings, quiet_hours_on: false }, new Date("2026-06-30T23:00:00Z"))).toBe(false);
  });
});

describe("cadence parsing + scheduling", () => {
  it("parses each token family", () => {
    expect(parseCadence("daily_0630")).toEqual({ type: "daily", hour: 6, minute: 30 });
    expect(parseCadence("after_4h")).toEqual({ type: "after", ms: 4 * 3600_000 });
    expect(parseCadence("after_5d")).toEqual({ type: "after", ms: 5 * 86_400_000 });
    expect(parseCadence("weekly_mon")).toMatchObject({ type: "weekly", weekday: 1 });
    expect(parseCadence("garbage")).toEqual({ type: "unknown" });
  });

  it("daily reminder is due within its slot only", () => {
    expect(isDailyDue("daily_0630", "UTC", new Date("2026-06-30T06:35:00Z"), 30)).toBe(true);
    expect(isDailyDue("daily_0630", "UTC", new Date("2026-06-30T08:00:00Z"), 30)).toBe(false);
  });

  it("weekly reminder is due only on its weekday", () => {
    // 2026-06-29 is a Monday
    expect(isWeeklyDue("weekly_mon", "UTC", new Date("2026-06-29T09:10:00Z"), 30)).toBe(true);
    expect(isWeeklyDue("weekly_mon", "UTC", new Date("2026-06-30T09:10:00Z"), 30)).toBe(false);
  });
});

describe("dedupe windows", () => {
  it("daily window is stable across ticks in the same day", () => {
    const a = windowKey("daily_0630", new Date("2026-06-30T06:31:00Z"));
    const b = windowKey("daily_0630", new Date("2026-06-30T06:59:00Z"));
    expect(a).toBe(b);
  });
  it("daily window differs across days", () => {
    const a = windowKey("daily_0630", new Date("2026-06-30T06:31:00Z"));
    const b = windowKey("daily_0630", new Date("2026-07-01T06:31:00Z"));
    expect(a).not.toBe(b);
  });
});
