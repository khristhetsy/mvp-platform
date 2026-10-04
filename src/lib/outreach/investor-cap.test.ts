import { describe, expect, it } from "vitest";
import { capMessage, capPeriod, decideCap, parseUtc } from "./investor-cap";

const signup = new Date("2026-09-10T08:00:00Z");

describe("30 day period from signup", () => {
  it("starts at signup and rolls every 30 days, not on the calendar month", () => {
    expect(capPeriod(signup, new Date("2026-09-10T08:00:00Z")).start.toISOString()).toBe("2026-09-10T08:00:00.000Z");
    expect(capPeriod(signup, new Date("2026-10-01T00:00:00Z")).start.toISOString()).toBe("2026-09-10T08:00:00.000Z");
    expect(capPeriod(signup, new Date("2026-10-10T08:00:00Z")).start.toISOString()).toBe("2026-10-10T08:00:00.000Z");
    expect(capPeriod(signup, new Date("2026-10-10T07:59:59Z")).end.toISOString()).toBe("2026-10-10T08:00:00.000Z");
  });
  it("reads timestamps without an offset as UTC", () => {
    expect(parseUtc("2026-09-10 08:00:00").toISOString()).toBe("2026-09-10T08:00:00.000Z");
    expect(parseUtc("2026-09-10T08:00:00+00:00").toISOString()).toBe("2026-09-10T08:00:00.000Z");
  });
});

describe("plan limit", () => {
  const reset = new Date("2026-10-10T08:00:00Z");
  it("allows up to the cap and refuses past it", () => {
    expect(decideCap(5, 3, 2, reset)).toEqual({ ok: true });
    expect(decideCap(5, 3, 3, reset)).toEqual({ ok: false, cap: 5, used: 3, remaining: 2, resetsAt: reset });
    expect(decideCap(50, 50, 1, reset)).toMatchObject({ ok: false, remaining: 0 });
  });
  it("never limits Managed IR or a start that adds no new investor", () => {
    expect(decideCap(null, 500, 100, reset)).toEqual({ ok: true });
    expect(decideCap(5, 9, 0, reset)).toEqual({ ok: true });
  });
  it("tells the founder what is left and when it resets", () => {
    const d = decideCap(5, 3, 4, reset);
    if (d.ok) throw new Error("expected refusal");
    expect(capMessage(d)).toBe("Your plan reaches up to 5 investors every 30 days. You've reached 3, so you can add 2 more until Oct 10.");
    const full = decideCap(5, 5, 1, reset);
    if (full.ok) throw new Error("expected refusal");
    expect(capMessage(full)).toContain("so you can't add more until Oct 10");
  });
});
