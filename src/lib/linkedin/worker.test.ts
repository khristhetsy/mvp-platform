import { describe, expect, it } from "vitest";
import { bearerKey, generateSenderKey, hashSenderKey, retryMinutesFor, senderKeyMatches, startOfLocalDay, tzOffsetMs, waitFromDecision } from "./worker";

describe("sender keys", () => {
  it("makes unique keys of the expected shape and matches only the right one", () => {
    const k = generateSenderKey();
    expect(k).toMatch(/^lis_[a-f0-9]{48}$/);
    expect(generateSenderKey()).not.toBe(k);
    const hash = hashSenderKey(k);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(senderKeyMatches(hash, k)).toBe(true);
    expect(senderKeyMatches(hash, generateSenderKey())).toBe(false);
    expect(senderKeyMatches(null, k)).toBe(false);
    expect(senderKeyMatches(hash, null)).toBe(false);
  });
  it("reads the bearer header", () => {
    const k = generateSenderKey();
    expect(bearerKey(`Bearer ${k}`)).toBe(k);
    expect(bearerKey(`bearer ${k}`)).toBeNull();
    expect(bearerKey("Bearer nope")).toBeNull();
    expect(bearerKey(null)).toBeNull();
  });
});

describe("local day", () => {
  it("finds midnight in Los Angeles (UTC-8 in November)", () => {
    expect(startOfLocalDay(new Date("2026-11-09T18:00:00Z"), "America/Los_Angeles").toISOString()).toBe("2026-11-09T08:00:00.000Z");
  });
  it("finds midnight in Paris after the date has already turned in UTC terms", () => {
    expect(startOfLocalDay(new Date("2026-11-09T23:30:00Z"), "Europe/Paris").toISOString()).toBe("2026-11-09T23:00:00.000Z");
  });
  it("handles the spring forward day", () => {
    expect(startOfLocalDay(new Date("2026-03-08T20:00:00Z"), "America/Los_Angeles").toISOString()).toBe("2026-03-08T08:00:00.000Z");
  });
  it("falls back to UTC for an unknown zone", () => {
    expect(startOfLocalDay(new Date("2026-11-09T18:00:00Z"), "Not/AZone").toISOString()).toBe("2026-11-09T00:00:00.000Z");
  });
  it("reports offsets", () => {
    expect(tzOffsetMs(new Date("2026-11-09T12:00:00Z"), "Europe/Paris")).toBe(3_600_000);
  });
});

describe("waits", () => {
  it("never asks the sender to retry sooner than the minimum gap", () => {
    expect(retryMinutesFor("gap")).toBe(4);
    expect(waitFromDecision({ ok: false, reason: "daily_cap" })).toEqual({ action: "wait", reason: "daily_cap", retryMinutes: 60 });
    expect(retryMinutesFor("weekly_cap")).toBeGreaterThan(retryMinutesFor("daily_cap"));
  });
});
