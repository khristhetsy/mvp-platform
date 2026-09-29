import { describe, expect, it } from "vitest";
import { DEFAULT_BUDGET, jobTier, normalizeBudget } from "./config";
import {
  budgetBucket,
  cohortFor,
  complaintState,
  digestDue,
  downshiftTarget,
  excerptOf,
  inQuietHours,
  localParts,
  primaryLinkOf,
  stepForStage,
} from "./rules";

describe("cohortFor", () => {
  it("puts nobody in the rollout at 0%", () => {
    for (let i = 0; i < 200; i++) expect(cohortFor(`user-${i}`, { rolloutPct: 0, holdoutPct: 10 })).not.toBe("rollout");
  });
  it("never overlaps rollout and holdout, and is stable", () => {
    const cfg = { rolloutPct: 90, holdoutPct: 10 };
    for (let i = 0; i < 500; i++) {
      const id = `f-${i}`;
      const b = budgetBucket(id);
      const c = cohortFor(id, cfg);
      expect(c).toBe(b >= 90 ? "holdout" : "rollout");
      expect(cohortFor(id, cfg)).toBe(c);
    }
  });
  it("roughly matches the percentages over many ids", () => {
    const counts = { rollout: 0, holdout: 0, control: 0 };
    for (let i = 0; i < 5000; i++) counts[cohortFor(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, { rolloutPct: 10, holdoutPct: 10 })]++;
    expect(counts.rollout).toBeGreaterThan(300);
    expect(counts.rollout).toBeLessThan(700);
    expect(counts.holdout).toBeGreaterThan(300);
    expect(counts.holdout).toBeLessThan(700);
  });
});

describe("normalizeBudget", () => {
  it("returns defaults for junk and keeps the rollout off", () => {
    expect(normalizeBudget(null)).toEqual(DEFAULT_BUDGET);
    expect(normalizeBudget("x").rolloutPct).toBe(0);
  });
  it("clamps the rollout below 100 minus the holdout and keeps pause at or above alert", () => {
    const n = normalizeBudget({ rolloutPct: 100, holdoutPct: 20, complaintAlertPct: 0.5, complaintPausePct: 0.2, quietStart: "25:00", rules: { quietHours: false } });
    expect(n.rolloutPct).toBe(80);
    expect(n.complaintPausePct).toBe(0.5);
    expect(n.quietStart).toBe(DEFAULT_BUDGET.quietStart);
    expect(n.rules.quietHours).toBe(false);
    expect(n.rules.batchIntoDigest).toBe(true);
  });
});

describe("jobTier", () => {
  it("holds only the founder facing digest jobs", () => {
    expect(jobTier("/api/cron/founder-nudges")).toBe("digest");
    expect(jobTier("/api/cron/founder-match-digest")).toBe("weekly");
    expect(jobTier("/api/cron/scheduled-reach-outs")).toBeNull();
    expect(jobTier("/api/cron/meeting-reminders")).toBeNull();
    expect(jobTier("/api/cron/founder-digest")).toBeNull();
    expect(jobTier(null)).toBeNull();
  });
});

describe("localParts and quiet hours", () => {
  it("reads the founder's own hour and weekday", () => {
    const now = new Date("2026-09-28T16:30:00Z"); // Monday
    expect(localParts(now, "America/Los_Angeles")).toMatchObject({ hour: 9, minute: 30, weekday: 1, dateKey: "2026-09-28" });
    expect(localParts(now, "Europe/Paris")).toMatchObject({ hour: 18, weekday: 1 });
    expect(localParts(now, "Not/AZone")).toMatchObject({ hour: 16, dateKey: "2026-09-28" });
  });
  it("handles a quiet window across midnight", () => {
    expect(inQuietHours({ hour: 21, minute: 0 }, "20:00", "08:00")).toBe(true);
    expect(inQuietHours({ hour: 7, minute: 59 }, "20:00", "08:00")).toBe(true);
    expect(inQuietHours({ hour: 8, minute: 0 }, "20:00", "08:00")).toBe(false);
    expect(inQuietHours({ hour: 13, minute: 0 }, "12:00", "14:00")).toBe(true);
  });
});

describe("digestDue", () => {
  const cfg = { dailyCap: 1, quietStart: "20:00", quietEnd: "08:00", rules: DEFAULT_BUDGET.rules };
  const local = { hour: 9, minute: 5, weekday: 2, dateKey: "2026-09-29" };
  it("sends daily at the send hour, once", () => {
    expect(digestDue({ mode: "daily", sendHour: 9, local, sentToday: 0, cfg })).toBe(true);
    expect(digestDue({ mode: "daily", sendHour: 9, local, sentToday: 1, cfg })).toBe(false);
    expect(digestDue({ mode: "daily", sendHour: 10, local, sentToday: 0, cfg })).toBe(false);
  });
  it("sends weekly only on Mondays and never for instant", () => {
    expect(digestDue({ mode: "weekly", sendHour: 9, local, sentToday: 0, cfg })).toBe(false);
    expect(digestDue({ mode: "weekly", sendHour: 9, local: { ...local, weekday: 1 }, sentToday: 0, cfg })).toBe(true);
    expect(digestDue({ mode: "instant", sendHour: 9, local, sentToday: 0, cfg })).toBe(false);
  });
  it("respects quiet hours unless the rule is off", () => {
    const late = { ...local, hour: 21 };
    expect(digestDue({ mode: "daily", sendHour: 21, local: late, sentToday: 0, cfg })).toBe(false);
    expect(digestDue({ mode: "daily", sendHour: 21, local: late, sentToday: 0, cfg: { ...cfg, rules: { ...cfg.rules, quietHours: false } } })).toBe(true);
  });
});

describe("downshiftTarget", () => {
  const now = new Date("2026-09-29T12:00:00Z");
  const day = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
  it("moves daily to weekly after N unopened settled digests", () => {
    const recent = [2, 3, 4].map((n) => ({ openedAt: null, clickedAt: null, sentAt: day(n) }));
    expect(downshiftTarget("daily", recent, 3, now)).toBe("weekly");
    expect(downshiftTarget("weekly", recent, 3, now)).toBe("instant");
  });
  it("does nothing if any was opened, if there are too few, or if a digest is under a day old", () => {
    expect(downshiftTarget("daily", [2, 3, 4].map((n, i) => ({ openedAt: i === 1 ? day(1) : null, clickedAt: null, sentAt: day(n) })), 3, now)).toBeNull();
    expect(downshiftTarget("daily", [2, 3].map((n) => ({ openedAt: null, clickedAt: null, sentAt: day(n) })), 3, now)).toBeNull();
    const recent = [0.2, 2, 3].map((n) => ({ openedAt: null, clickedAt: null, sentAt: day(n) }));
    expect(downshiftTarget("daily", recent, 3, now)).toBeNull();
    expect(downshiftTarget("daily", [2, 3, 4].map((n) => ({ openedAt: null, clickedAt: null, sentAt: day(n) })), 0, now)).toBeNull();
  });
});

describe("complaintState", () => {
  const cfg = { complaintAlertPct: 0.1, complaintPausePct: 0.3, complaintMinSample: 500, rules: DEFAULT_BUDGET.rules };
  it("alerts at 0.1% and pauses at 0.3% only with enough volume", () => {
    expect(complaintState(1000, 0, cfg).level).toBe("ok");
    expect(complaintState(1000, 1, cfg).level).toBe("alert");
    expect(complaintState(1000, 3, cfg).level).toBe("pause");
    expect(complaintState(100, 3, cfg).level).toBe("alert");
    expect(complaintState(0, 0, cfg)).toMatchObject({ rate: 0, level: "ok" });
  });
  it("never pauses when the guard is off", () => {
    expect(complaintState(1000, 10, { ...cfg, rules: { ...cfg.rules, complaintGuard: false } }).level).toBe("ok");
  });
});

describe("excerptOf and primaryLinkOf", () => {
  it("prefers text and trims long content at a word", () => {
    expect(excerptOf("<p>ignored</p>", "  Plain   text  ")).toBe("Plain text");
    const long = excerptOf(null, "word ".repeat(100), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith("…")).toBe(true);
  });
  it("strips markup and entities", () => {
    expect(excerptOf("<style>.x{}</style><h1>Hi&nbsp;there</h1><p>Upload &amp; go</p>", null)).toBe("Hi there Upload & go");
  });
  it("skips unsubscribe and settings links", () => {
    const html = `<a href="https://icapos.com/api/email/unsubscribe?t=1">x</a><a href="https://icapos.com/founder/readiness?a=1&amp;b=2">Go</a>`;
    expect(primaryLinkOf(html)).toBe("https://icapos.com/founder/readiness?a=1&b=2");
    expect(primaryLinkOf("<p>none</p>")).toBeNull();
  });
});

describe("stepForStage", () => {
  it("maps journey stages to Rate, Ready, Match, Raise", () => {
    expect([stepForStage("initialize"), stepForStage("qualify"), stepForStage("deploy"), stepForStage("optimize"), stepForStage(null)]).toEqual([0, 1, 2, 3, 0]);
  });
});
