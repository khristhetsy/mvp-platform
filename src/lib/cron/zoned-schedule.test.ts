import { describe, expect, it } from "vitest";
import {
  cronFromForm,
  dueNow,
  formFromCron,
  formFromUtcDefault,
  nextRunsInZone,
  utcToZonedLocal,
  validCustomCron,
  zonedLocalToUtc,
} from "@/lib/cron/zoned-schedule";

// Sunday 27 September 2026, 10:30 UTC = 12:30 in Paris (summer time, UTC+2).
const NOW = new Date("2026-09-27T10:30:00Z");

describe("custom schedules in Paris time", () => {
  it("runs at the Paris wall clock time on both sides of the clock change", () => {
    const runs = nextRunsInZone(["0 11 * * *"], new Date("2026-10-24T12:00:00Z"), 2);
    // 25 Oct is the switch to winter time: 11:00 Paris is 09:00 UTC before, 10:00 UTC after.
    expect(runs.map((d) => d.toISOString())).toEqual(["2026-10-25T10:00:00.000Z", "2026-10-26T10:00:00.000Z"]);
    expect(nextRunsInZone(["0 11 * * *"], NOW)[0]?.toISOString()).toBe("2026-09-28T09:00:00.000Z");
  });

  it("finds weekly runs and several at once", () => {
    const runs = nextRunsInZone(["30 9 * * 1,3"], NOW, 3).map((d) => d.toISOString());
    expect(runs).toEqual(["2026-09-28T07:30:00.000Z", "2026-09-30T07:30:00.000Z", "2026-10-05T07:30:00.000Z"]);
  });

  it("converts a datetime input value both ways", () => {
    const at = zonedLocalToUtc("2026-09-28T09:30");
    expect(at?.toISOString()).toBe("2026-09-28T07:30:00.000Z");
    expect(utcToZonedLocal(at!)).toBe("2026-09-28T09:30");
    expect(zonedLocalToUtc("2026-12-01T09:30")?.toISOString()).toBe("2026-12-01T08:30:00.000Z");
    expect(zonedLocalToUtc("tomorrow")).toBeNull();
  });
});

describe("the edit form", () => {
  it("builds expressions from each repeat mode and reads them back", () => {
    const daily = { mode: "daily" as const, every: 15, minute: 0, times: ["11:00", "17:30", "09:00"], days: [1] };
    expect(cronFromForm(daily)).toEqual(["0 9,11 * * *", "30 17 * * *"]);
    expect(formFromCron(["0 9,11 * * *", "30 17 * * *"])).toMatchObject({ mode: "daily", times: ["09:00", "11:00", "17:30"] });
    expect(cronFromForm({ ...daily, mode: "weekly", times: ["09:00"], days: [3, 1] })).toEqual(["0 9 * * 1,3"]);
    expect(cronFromForm({ ...daily, mode: "every", every: 15 })).toEqual(["*/15 * * * *"]);
    expect(cronFromForm({ ...daily, mode: "hourly", minute: 7 })).toEqual(["7 * * * *"]);
    expect(cronFromForm({ ...daily, mode: "weekly", days: [] })).toBeNull();
    expect(cronFromForm({ ...daily, times: ["25:00"] })).toBeNull();
  });

  it("opens on the job's vercel.json schedule read in Paris time", () => {
    expect(formFromUtcDefault(["0 9 * * *"], NOW)).toMatchObject({ mode: "daily", times: ["11:00"] });
    expect(formFromUtcDefault(["0 13 * * 1"], NOW)).toMatchObject({ mode: "weekly", times: ["15:00"], days: [1] });
    expect(formFromUtcDefault(["0 23 * * 1"], NOW)).toMatchObject({ mode: "weekly", times: ["01:00"], days: [2] });
    expect(formFromUtcDefault(["*/5 * * * *"], NOW)).toMatchObject({ mode: "every", every: 5 });
  });

  it("refuses schedules more often than every 5 minutes", () => {
    expect(validCustomCron(["*/5 * * * *"])).toBe(true);
    expect(validCustomCron(["0 9,11 * * *", "30 17 * * *"])).toBe(true);
    expect(validCustomCron(["* * * * *"])).toBe(false);
    expect(validCustomCron(["*/2 * * * *"])).toBe(false);
    expect(validCustomCron(["nonsense"])).toBe(false);
  });
});

describe("dispatcher timing", () => {
  const base = { job: "/api/cron/founder-nudges", cron: "0 11 * * *", next_run_at: null, last_dispatch_at: "2026-09-27T08:00:00Z", updated_at: "2026-09-26T08:00:00Z" };
  it("starts a job once its Paris time has passed since the last start", () => {
    expect(dueNow(base, new Date("2026-09-27T08:55:00Z")).run).toBe(false);
    expect(dueNow(base, new Date("2026-09-27T09:02:00Z")).run).toBe(true);
    expect(dueNow({ ...base, last_dispatch_at: "2026-09-27T09:02:00Z" }, new Date("2026-09-27T09:07:00Z")).run).toBe(false);
  });
  it("starts a one-off next run when its time comes", () => {
    const row = { ...base, cron: null, next_run_at: "2026-09-28T07:30:00Z" };
    expect(dueNow(row, new Date("2026-09-28T07:25:00Z"))).toEqual({ run: false, oneOff: false });
    expect(dueNow(row, new Date("2026-09-28T07:31:00Z"))).toEqual({ run: true, oneOff: true });
  });
});
