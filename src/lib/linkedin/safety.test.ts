import { describe, expect, it } from "vitest";
import {
  acceptanceTooLow,
  canSendInvite,
  canSendMessage,
  dailyAutoCap,
  dailyMessageCap,
  dailyTotalCap,
  hubTokenState,
  inWorkingHours,
  levelSpec,
  manualReserve,
  randomGapMinutes,
  shouldWithdrawInvite,
  warmUpDay,
  weeklyAutoCap,
  type AccountSafety,
} from "./safety";

const START = new Date("2026-11-09T12:00:00Z"); // a Monday
const at = (days: number) => new Date(START.getTime() + days * 86_400_000);
const std: AccountSafety = { level: "standard", warmUpStartedAt: START };

describe("warm up", () => {
  it("is day 0 before the warm up starts", () => {
    expect(warmUpDay(null, START)).toBe(0);
    expect(warmUpDay(at(1), START)).toBe(0);
  });
  it("counts days from 1", () => {
    expect(warmUpDay(START, START)).toBe(1);
    expect(warmUpDay(START, at(20))).toBe(21);
  });
  it("sends nothing before it starts", () => {
    expect(dailyTotalCap({ level: "standard", warmUpStartedAt: null }, START)).toBe(0);
  });
  it("ramps Standard from 5 to 20 over 21 days and then stays at 20", () => {
    expect(dailyTotalCap(std, at(0))).toBe(5);
    expect(dailyTotalCap(std, at(20))).toBe(20);
    expect(dailyTotalCap(std, at(60))).toBe(20);
    const caps = Array.from({ length: 21 }, (_, d) => dailyTotalCap(std, at(d)));
    expect([...caps].sort((a, b) => a - b)).toEqual(caps);
  });
  it("ramps Careful from 3 to 10", () => {
    const c: AccountSafety = { level: "careful", warmUpStartedAt: START };
    expect(dailyTotalCap(c, at(0))).toBe(3);
    expect(dailyTotalCap(c, at(30))).toBe(10);
  });
});

describe("caps", () => {
  it("keeps 5 a day for invites sent by hand at full speed", () => {
    expect(manualReserve(std, at(30))).toBe(5);
    expect(dailyAutoCap(std, at(30))).toBe(15);
  });
  it("never reserves more than half of a small day", () => {
    expect(manualReserve(std, at(0))).toBe(2);
    expect(dailyAutoCap(std, at(0))).toBe(3);
  });
  it("counts the reserve toward the weekly limit", () => {
    expect(weeklyAutoCap(std, at(30))).toBe(80 - 25);
    expect(weeklyAutoCap({ level: "standard", warmUpStartedAt: null }, START)).toBe(0);
  });
  it("clamps custom limits to the Standard ceiling", () => {
    const spec = levelSpec({ level: "custom", customDaily: 500, customWeekly: 900 });
    expect(spec.daily).toBe(20);
    expect(spec.weekly).toBe(80);
    expect(levelSpec({ level: "custom", customDaily: 8, customWeekly: 30 })).toMatchObject({ daily: 8, weekly: 30 });
  });
});

describe("working hours", () => {
  it("allows weekday office hours in the owner's zone", () => {
    expect(inWorkingHours(new Date("2026-11-09T18:00:00Z"), { timeZone: "America/Los_Angeles" })).toBe(true); // 10:00 Monday
  });
  it("blocks nights, weekends and unknown zones", () => {
    expect(inWorkingHours(new Date("2026-11-09T04:00:00Z"), { timeZone: "America/Los_Angeles" })).toBe(false); // Sunday evening
    expect(inWorkingHours(new Date("2026-11-14T18:00:00Z"), { timeZone: "America/Los_Angeles" })).toBe(false); // Saturday
    expect(inWorkingHours(new Date("2026-11-09T18:00:00Z"), { timeZone: "Not/AZone" })).toBe(false);
  });
});

describe("canSendInvite", () => {
  const account = { ...std, status: "connected" as const, timeZone: "America/Los_Angeles" };
  const monday10am = new Date("2026-11-09T18:00:00Z");
  it("allows a send inside every limit", () => {
    expect(canSendInvite({ account, now: monday10am, sentToday: 0, sentLast7Days: 0 })).toEqual({ ok: true });
  });
  it("stops at the daily cap", () => {
    const r = canSendInvite({ account, now: monday10am, sentToday: 3, sentLast7Days: 3 });
    expect(r).toEqual({ ok: false, reason: "daily_cap" });
  });
  it("stops when the account is paused or the warm up has not begun", () => {
    expect(canSendInvite({ account: { ...account, status: "warning" }, now: monday10am, sentToday: 0, sentLast7Days: 0 })).toEqual({ ok: false, reason: "paused" });
    expect(canSendInvite({ account: { ...account, warmUpStartedAt: null }, now: monday10am, sentToday: 0, sentLast7Days: 0 })).toEqual({ ok: false, reason: "not_started" });
  });
  it("stops outside working hours", () => {
    const r = canSendInvite({ account, now: new Date("2026-11-10T04:00:00Z"), sentToday: 0, sentLast7Days: 0 }); // 8pm Monday in Los Angeles
    expect(r).toEqual({ ok: false, reason: "outside_hours" });
  });
});

describe("acceptance floor", () => {
  it("waits for 50 invites before judging", () => {
    expect(acceptanceTooLow({ invited: 49, accepted: 0 })).toBe(false);
  });
  it("pauses below 20 percent and not at 20 percent", () => {
    expect(acceptanceTooLow({ invited: 50, accepted: 9 })).toBe(true);
    expect(acceptanceTooLow({ invited: 50, accepted: 10 })).toBe(false);
  });
});

describe("timing helpers", () => {
  it("keeps random gaps inside the range", () => {
    expect(randomGapMinutes(() => 0)).toBe(4);
    expect(randomGapMinutes(() => 0.999)).toBe(18);
  });
  it("withdraws invites pending 3 weeks or more", () => {
    expect(shouldWithdrawInvite(at(0), at(20))).toBe(false);
    expect(shouldWithdrawInvite(at(0), at(21))).toBe(true);
    expect(shouldWithdrawInvite("not a date", at(21))).toBe(false);
  });
});

describe("hub connection state", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  it("flags a connection that ends within 7 days or has ended", () => {
    expect(hubTokenState("2026-11-10T10:27:00Z", now)).toBe("soon");
    expect(hubTokenState("2026-11-27T18:00:00Z", now)).toBe("ok");
    expect(hubTokenState("2026-11-01T00:00:00Z", now)).toBe("expired");
    expect(hubTokenState(null, now)).toBe("ok");
  });
});

describe("messages to existing connections", () => {
  const acct = { ...std, status: "connected" as const, timeZone: "UTC" };
  it("is zero until the warm up starts, then rises to 15 on Standard", () => {
    expect(dailyMessageCap({ level: "standard", warmUpStartedAt: null }, START)).toBe(0);
    expect(dailyMessageCap(std, START)).toBe(3);
    expect(dailyMessageCap(std, at(20))).toBe(15);
    expect(dailyMessageCap(std, at(60))).toBe(15);
  });
  it("is lower on Careful and never above Standard on a custom level", () => {
    expect(dailyMessageCap({ level: "careful", warmUpStartedAt: START }, at(60))).toBe(8);
    expect(dailyMessageCap({ level: "custom", customDaily: 20, customWeekly: 80, warmUpStartedAt: START }, at(60))).toBe(15);
    expect(dailyMessageCap({ level: "custom", customDaily: 4, customWeekly: 20, warmUpStartedAt: START }, at(60))).toBe(4);
  });
  it("stops at the cap, outside working hours and when paused", () => {
    const noon = new Date("2026-11-10T12:00:00Z"); // Tuesday
    expect(canSendMessage({ account: acct, now: noon, sentToday: 0 })).toEqual({ ok: true });
    expect(canSendMessage({ account: acct, now: noon, sentToday: 15 })).toEqual({ ok: false, reason: "daily_cap" });
    expect(canSendMessage({ account: acct, now: new Date("2026-11-10T03:00:00Z"), sentToday: 0 })).toEqual({ ok: false, reason: "outside_hours" });
    expect(canSendMessage({ account: { ...acct, status: "paused" }, now: noon, sentToday: 0 })).toEqual({ ok: false, reason: "paused" });
  });
});
