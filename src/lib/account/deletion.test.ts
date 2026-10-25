import { describe, expect, it } from "vitest";
import { DELETION_GRACE_DAYS, isConfirmPhrase, isPurgeDue, scheduledPurgeDate } from "./deletion";

describe("account deletion helpers", () => {
  it("accepts the confirm phrase regardless of case and padding", () => {
    expect(isConfirmPhrase("delete my account")).toBe(true);
    expect(isConfirmPhrase("  Delete My Account ")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isConfirmPhrase("delete")).toBe(false);
    expect(isConfirmPhrase("")).toBe(false);
    expect(isConfirmPhrase(undefined)).toBe(false);
    expect(isConfirmPhrase(42)).toBe(false);
  });

  it("schedules the purge 30 days out", () => {
    const from = new Date("2026-10-25T12:00:00Z");
    expect(scheduledPurgeDate(from).toISOString()).toBe("2026-11-24T12:00:00.000Z");
    expect(DELETION_GRACE_DAYS).toBe(30);
  });

  it("is due only once the date has passed", () => {
    const now = new Date("2026-11-24T12:00:00Z");
    expect(isPurgeDue("2026-11-24T12:00:00Z", now)).toBe(true);
    expect(isPurgeDue("2026-11-24T12:00:01Z", now)).toBe(false);
    expect(isPurgeDue(null, now)).toBe(false);
    expect(isPurgeDue("not a date", now)).toBe(false);
  });
});
