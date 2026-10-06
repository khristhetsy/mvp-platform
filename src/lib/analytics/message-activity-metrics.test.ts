import { describe, expect, it } from "vitest";
import {
  changeVs,
  chartBuckets,
  goalAt,
  goalForRange,
  metricValue,
  localDay,
  dayStartUtc,
  periodLabel,
  periodRange,
  previousRange,
  receivedType,
  toPerMonth,
  type GoalEntry,
  type ReceivedItem,
  type SentItem,
} from "./message-activity-metrics";

const goal = (month: string, perMonth: number | null, key: GoalEntry["metricKey"] = "i_preview"): GoalEntry => ({
  id: `${key}-${month}`, metricKey: key, month, perMonth, amount: perMonth, basis: "month",
  direction: "up", note: null, createdBy: null, createdByName: null, createdAt: "2026-10-01T00:00:00Z",
});

describe("periods", () => {
  it("weeks run Monday to Sunday", () => {
    expect(periodRange("week", "2026-10-06")).toEqual({ start: "2026-10-05", end: "2026-10-11" });
  });

  it("quarters and years", () => {
    expect(periodRange("quarter", "2026-11-15")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(periodRange("year", "2026-03-02")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(periodRange("month", "2024-02-10")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });

  it("previous period is the same kind, or the same length for a custom range", () => {
    expect(previousRange("week", periodRange("week", "2026-10-06"), "2026-10-06")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
    expect(previousRange("custom", { start: "2026-10-01", end: "2026-10-10" }, "2026-10-10")).toEqual({ start: "2026-09-21", end: "2026-09-30" });
  });

  it("labels", () => {
    expect(periodLabel("week", { start: "2026-10-05", end: "2026-10-11" })).toBe("Week of 5 Oct to 11 Oct 2026");
    expect(periodLabel("quarter", { start: "2026-10-01", end: "2026-12-31" })).toBe("Q4 2026");
  });
});

describe("Pacific days", () => {
  it("starts a Pacific day at the right UTC instant, summer and winter", () => {
    expect(dayStartUtc("2026-10-06").toISOString()).toBe("2026-10-06T07:00:00.000Z");
    expect(dayStartUtc("2026-12-01").toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });

  it("reads the Pacific calendar day of an instant", () => {
    expect(localDay("2026-10-06T07:30:00Z")).toBe("2026-10-06");
    expect(localDay("2026-10-06T06:30:00Z")).toBe("2026-10-05");
  });

  it("buckets a week by day and a year by month", () => {
    expect(chartBuckets("week", periodRange("week", "2026-10-06")).keys).toHaveLength(7);
    expect(chartBuckets("year", periodRange("year", "2026-10-06")).keys).toHaveLength(12);
    expect(chartBuckets("day", { start: "2026-10-06", end: "2026-10-06" }).keys).toHaveLength(24);
  });
});

describe("message types and metrics", () => {
  const rec = (source: string, channel: ReceivedItem["channel"] = "in_app"): ReceivedItem => ({
    id: source, at: "2026-10-06T07:00:00Z", personKey: "p", channel, title: "", message: null, source, status: "unread", link: null, emailId: null,
  });

  it("classifies received items", () => {
    expect(receivedType(rec("founder_match_digest", "email"))).toBe("email");
    expect(receivedType(rec("orchestration_overdue"))).toBe("alert");
    expect(receivedType(rec("reminder_generated"))).toBe("reminder");
    expect(receivedType(rec("remediation_task_created"))).toBe("remediation");
    expect(receivedType(rec("outreach_intros_sent"))).toBe("intro");
    expect(receivedType(rec("company_approved"))).toBe("other");
  });

  it("counts distinct investors reached, excluding skipped sends and intro requests", () => {
    const s = (investorEmail: string, kind: SentItem["kind"], status = "sent"): SentItem => ({
      id: investorEmail + kind + status, at: "2026-10-06T07:00:00Z", personKey: "p", kind, investor: investorEmail,
      investorEmail, status, title: "", emailId: null, detail: null, handledAt: null,
    });
    const data = { received: [], sent: [s("a@x.com", "preview"), s("a@x.com", "preview"), s("b@x.com", "diy"), s("c@x.com", "preview", "skipped"), s("d@x.com", "intro", "new")] };
    expect(metricValue("i_reach", data)).toBe(2);
    expect(metricValue("i_preview", data)).toBe(2);
    expect(metricValue("i_intro", data)).toBe(1);
  });
});

describe("goals", () => {
  it("converts any basis to a monthly goal", () => {
    expect(toPerMonth(25, "week")).toBeCloseTo(108.71, 1);
    expect(toPerMonth(300, "quarter")).toBe(100);
  });

  it("uses the goal in force for each month", () => {
    const entries = [goal("2026-09", 60), goal("2026-11", null)];
    expect(goalAt(entries, "i_preview", "2026-10")?.perMonth).toBe(60);
    expect(goalAt(entries, "i_preview", "2026-12")?.perMonth).toBeNull();
    expect(goalAt(entries, "i_preview", "2026-08")).toBeNull();
  });

  it("prorates across months and reports days with no goal", () => {
    const entries = [goal("2026-10", 31)];
    const week = goalForRange(entries, "i_preview", { start: "2026-10-05", end: "2026-10-11" });
    expect(week?.goal).toBeCloseTo(7);
    const span = goalForRange(entries, "i_preview", { start: "2026-09-29", end: "2026-10-02" });
    expect(span?.goal).toBeCloseTo(2);
    expect(span?.coveredDays).toBe(2);
    expect(span?.totalDays).toBe(4);
    expect(goalForRange(entries, "f_email", { start: "2026-10-01", end: "2026-10-31" })).toBeNull();
  });

  it("describes the change against the previous period", () => {
    expect(changeVs(9, 25)).toEqual({ kind: "change", previous: 25, pct: -64 });
    expect(changeVs(3, 0)).toEqual({ kind: "new", previous: 0 });
    expect(changeVs(0, 0)).toEqual({ kind: "same", previous: 0 });
  });
});
