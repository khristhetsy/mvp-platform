import { describe, expect, it } from "vitest";
import { baselineReady, daysCovered, diffPercent, labelQuery, mean, normalRange, percentOfLimit, queryVerdict, stdev, verdictFor } from "./baseline";

describe("mean and stdev", () => {
  it("compute the average and population deviation", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
    expect(stdev([5])).toBe(0);
    expect(mean([])).toBe(0);
  });
});

describe("normalRange", () => {
  const ok = Array.from({ length: 30 }, (_, i) => (i % 2 ? 0.4 : 0.2));
  it("is null with too few readings", () => expect(normalRange([1, 2, 3])).toBeNull());
  it("is the average plus or minus one deviation, never below 0", () => {
    const r = normalRange(ok)!;
    expect(r.avg).toBeCloseTo(0.3);
    expect(r.hi).toBeCloseTo(0.4);
    expect(r.lo).toBeCloseTo(0.2);
    expect(normalRange(Array.from({ length: 30 }, (_, i) => (i === 0 ? 100 : 0)))!.lo).toBe(0);
  });
  it("ignores non finite readings", () => expect(normalRange([...ok, NaN, Infinity])!.n).toBe(30));
});

describe("verdictFor", () => {
  const r = { avg: 0.4, lo: 0.2, hi: 0.6, n: 100 };
  it("labels against the range", () => {
    expect(verdictFor(7.4, r)).toBe("above");
    expect(verdictFor(0.4, r)).toBe("normal");
    expect(verdictFor(0.6, r)).toBe("normal");
    expect(verdictFor(0.1, r)).toBe("below");
  });
});

describe("percentages", () => {
  it("gives the change against average", () => {
    expect(diffPercent(7.4, 0.4)).toBe(1750);
    expect(diffPercent(0.3, 0.4)).toBe(-25);
    expect(diffPercent(1, 0)).toBeNull();
  });
  it("gives percent of a limit", () => {
    expect(percentOfLimit(7.4, 5)).toBe(148);
    expect(percentOfLimit(48, 30)).toBe(160);
    expect(percentOfLimit(1, 0)).toBeNull();
  });
});

describe("baseline readiness", () => {
  const now = Date.parse("2026-11-10T00:00:00Z");
  it("needs 7 days of readings", () => {
    expect(daysCovered(null, now)).toBe(0);
    expect(baselineReady("2026-11-04T00:00:00Z", now)).toBe(false);
    expect(baselineReady("2026-11-03T00:00:00Z", now)).toBe(true);
  });
});

describe("queryVerdict", () => {
  it("compares an average with the 90th percentile", () => {
    expect(queryVerdict(732, 47.2)).toEqual({ verdict: "above", timesOver: 15.5 });
    expect(queryVerdict(8, 47.2)).toEqual({ verdict: "normal", timesOver: 0.2 });
    expect(queryVerdict(8, null)).toEqual({ verdict: null, timesOver: null });
  });
});

describe("labelQuery", () => {
  it("names known statements and falls back to the SQL", () => {
    expect(labelQuery("SELECT wal->>$5 as type FROM x")).toBe("Realtime change polling");
    expect(labelQuery("SELECT name FROM pg_timezone_names")).toBe("Timezone name list");
    expect(labelQuery('WITH pgrst_source AS ( SELECT "public"."crm_contacts"."id" FROM "public"."crm_contacts" WHERE "email_status" = $1')).toBe("Contact search by email status");
    expect(labelQuery("select 1   from   foo")).toBe("select 1 from foo");
  });
});
