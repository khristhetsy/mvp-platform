import { describe, expect, it } from "vitest";
import { describeSchedule, formatWhen, nextRun, parseCron } from "@/lib/cron/schedule";

// Saturday 26 September 2026, 08:30 UTC = 10:30 in Paris (UTC+2).
const NOW = new Date("2026-09-26T08:30:00Z");

describe("parseCron", () => {
  it("accepts every shape in vercel.json and rejects junk", () => {
    for (const e of ["*/5 * * * *", "7 * * * *", "0 7 * * *", "0 6,15 * * *", "0 */4 * * *", "0 13 * * 1"]) {
      expect(parseCron(e)).not.toBeNull();
    }
    expect(parseCron("61 * * * *")).toBeNull();
    expect(parseCron("* * *")).toBeNull();
  });
});

describe("nextRun", () => {
  it("finds the next firing across several expressions", () => {
    expect(nextRun(["0 7 * * *", "0 19 * * *"], NOW)?.toISOString()).toBe("2026-09-26T19:00:00.000Z");
    expect(nextRun(["*/5 * * * *"], NOW)?.toISOString()).toBe("2026-09-26T08:35:00.000Z");
    expect(nextRun(["0 13 * * 1"], NOW)?.toISOString()).toBe("2026-09-28T13:00:00.000Z");
    expect(nextRun(["0 */4 * * *"], NOW)?.toISOString()).toBe("2026-09-26T12:00:00.000Z");
  });
  it("is strictly after the given time", () => {
    expect(nextRun(["0 9 * * *"], new Date("2026-09-26T09:00:00Z"))?.toISOString()).toBe("2026-09-27T09:00:00.000Z");
  });
});

describe("describeSchedule", () => {
  it("says each common shape in Paris time", () => {
    expect(describeSchedule(["0 7 * * *", "0 19 * * *"], NOW)).toBe("Daily 09:00 and 21:00");
    expect(describeSchedule(["*/5 * * * *"], NOW)).toBe("Every 5 min");
    expect(describeSchedule(["7 * * * *"], NOW)).toBe("Hourly at :07");
    expect(describeSchedule(["0 */4 * * *"], NOW)).toBe("Every 4 h");
    expect(describeSchedule(["0 6,15 * * *"], NOW)).toBe("Daily 08:00 and 17:00");
    expect(describeSchedule(["0 13 * * 1"], NOW)).toBe("Mon 15:00");
  });
  it("follows daylight saving: 19:00 UTC is 20:00 in Paris in winter", () => {
    expect(describeSchedule(["0 19 * * *"], new Date("2026-12-01T12:00:00Z"))).toBe("Daily 20:00");
  });
  it("shows anything unusual as written", () => {
    expect(describeSchedule(["0 0 1 * *"], NOW)).toBe("0 0 1 * *");
  });
});

describe("formatWhen", () => {
  it("names today, tomorrow and later days in Paris time", () => {
    expect(formatWhen(new Date("2026-09-26T19:00:00Z"), NOW)).toBe("today 21:00");
    expect(formatWhen(new Date("2026-09-27T09:00:00Z"), NOW)).toBe("tomorrow 11:00");
    expect(formatWhen(new Date("2026-09-28T13:00:00Z"), NOW)).toBe("Mon 15:00");
    expect(formatWhen(new Date("2026-09-25T20:00:00Z"), NOW)).toBe("yesterday 22:00");
  });
});
