import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatRunTime, nextCronSlot, nextOutreachRun, OUTREACH_RUN_HOURS_UTC } from "@/lib/outreach/outreach-schedule";

describe("outreach schedule", () => {
  it("matches the orchestration cron hours in vercel.json", () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as { crons: Array<{ path: string; schedule: string }> };
    const hours = cfg.crons
      .filter((c) => c.path === "/api/cron/run-orchestration")
      .map((c) => {
        const [min, hour] = c.schedule.split(" ");
        expect(min).toBe("0");
        return Number(hour);
      })
      .sort((a, b) => a - b);
    expect(hours).toEqual([...OUTREACH_RUN_HOURS_UTC]);
  });

  it("picks the next 07:00 or 19:00 UTC slot", () => {
    expect(nextCronSlot(new Date("2026-10-07T06:59:00Z")).toISOString()).toBe("2026-10-07T07:00:00.000Z");
    expect(nextCronSlot(new Date("2026-10-07T07:00:01Z")).toISOString()).toBe("2026-10-07T19:00:00.000Z");
    expect(nextCronSlot(new Date("2026-10-07T20:00:00Z")).toISOString()).toBe("2026-10-08T07:00:00.000Z");
  });

  it("waits 6 days after the last run, then takes the next slot", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    expect(nextOutreachRun({ lastRunAt: "2026-10-03T07:00:12Z" }, now).toISOString()).toBe("2026-10-09T19:00:00.000Z");
    expect(nextOutreachRun({ lastRunAt: null }, now).toISOString()).toBe("2026-10-07T19:00:00.000Z");
  });

  it("respects a start date and holds through a pause's resume day", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    expect(nextOutreachRun({ startDate: "2026-10-12" }, now).toISOString()).toBe("2026-10-12T07:00:00.000Z");
    expect(nextOutreachRun({ pauseUntil: "2026-10-12" }, now).toISOString()).toBe("2026-10-13T07:00:00.000Z");
  });

  it("formats for founders in Pacific time, summer and winter", () => {
    expect(formatRunTime(new Date("2026-10-09T19:00:00Z"))).toBe("Friday, October 9 around 12:00 PM PT");
    expect(formatRunTime(new Date("2026-10-10T07:00:00Z"))).toBe("Saturday, October 10 around 12:00 AM PT");
    // After the switch back to standard time, 07:00 UTC is 11 PM the previous day in PT.
    expect(formatRunTime(new Date("2026-12-10T07:00:00Z"))).toBe("Wednesday, December 9 around 11:00 PM PT");
  });
});
