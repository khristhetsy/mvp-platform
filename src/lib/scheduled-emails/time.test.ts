import { describe, expect, it } from "vitest";
import { formatSendAt, sendPresets, validSendAt } from "./time";

describe("scheduled email times (PT)", () => {
  it("offers tomorrow 8 AM, tomorrow 1 PM and next Monday 8 AM in Pacific time", () => {
    // Thu Oct 8 2026, 5:20 AM PT (12:20 UTC). PDT is UTC-7.
    const now = new Date("2026-10-08T12:20:00Z");
    const [morning, afternoon, monday] = sendPresets(now);
    expect(morning.iso).toBe("2026-10-09T15:00:00.000Z");
    expect(afternoon.iso).toBe("2026-10-09T20:00:00.000Z");
    expect(monday.iso).toBe("2026-10-12T15:00:00.000Z");
  });

  it("uses the PT date, not the UTC date, late in the PT evening", () => {
    // Thu Oct 8 2026, 10 PM PT is already Friday in UTC.
    const now = new Date("2026-10-09T05:00:00Z");
    expect(sendPresets(now)[0].iso).toBe("2026-10-09T15:00:00.000Z");
  });

  it("on a Monday, Monday morning means the following Monday", () => {
    const now = new Date("2026-10-12T17:00:00Z"); // Mon Oct 12, 10 AM PT
    expect(sendPresets(now)[2].iso).toBe("2026-10-19T15:00:00.000Z");
  });

  it("follows the clock change (PST is UTC-8 in November)", () => {
    const now = new Date("2026-11-10T18:00:00Z");
    expect(sendPresets(now)[0].iso).toBe("2026-11-11T16:00:00.000Z");
  });

  it("rejects empty, past and far future times", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    expect(validSendAt("", now)).toBe("Pick a date and time first.");
    expect(validSendAt("2026-10-08T11:00:00Z", now)).toBe("Pick a time in the future.");
    expect(validSendAt("2028-01-01T00:00:00Z", now)).toBe("Pick a time within the next year.");
    expect(validSendAt("2026-10-09T15:00:00Z", now)).toBeNull();
  });

  it("formats send times in PT", () => {
    expect(formatSendAt("2026-10-09T15:00:00.000Z")).toBe("Fri, Oct 9, 8:00 AM PT");
  });
});
