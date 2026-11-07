import { describe, expect, it } from "vitest";
import { nextRuns } from "@/lib/marketing/sequence-schedule";

describe("weekly send schedule (Pacific Time)", () => {
  const s = { repeat: "weekly" as const, weekdays: [1], start_date: "2026-11-02", end_date: null, send_time: "05:00" };
  it("sends Mondays at 5:00 AM PT, which is 8:00 AM New York", () => {
    const [a, b] = nextRuns(s, new Date("2026-11-04T12:00:00Z"), 2);
    expect(a.toISOString()).toBe("2026-11-09T13:00:00.000Z"); // 5 AM PST
    expect(b.toISOString()).toBe("2026-11-16T13:00:00.000Z");
    expect(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: true }).format(a)).toBe("8 AM");
  });
});
