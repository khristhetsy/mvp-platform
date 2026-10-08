import { describe, expect, it } from "vitest";
import { payloadWithoutSchedule, scheduleAtFrom } from "./schedule";

describe("schedule send request helpers", () => {
  it("reads scheduleAt only when it is a non empty string", () => {
    expect(scheduleAtFrom({ scheduleAt: "2026-10-09T15:00:00Z" })).toBe("2026-10-09T15:00:00Z");
    expect(scheduleAtFrom({ scheduleAt: "  " })).toBeNull();
    expect(scheduleAtFrom({ scheduleAt: 123 })).toBeNull();
    expect(scheduleAtFrom({})).toBeNull();
    expect(scheduleAtFrom(null)).toBeNull();
  });

  it("stores the request exactly as posted, minus scheduleAt, so the replay sends now", () => {
    const raw = { to: "a@b.co", subject: "Hi", body: "x", scheduleAt: "2026-10-09T15:00:00Z" };
    expect(payloadWithoutSchedule(raw)).toEqual({ to: "a@b.co", subject: "Hi", body: "x" });
    expect(raw.scheduleAt).toBe("2026-10-09T15:00:00Z");
  });
});
