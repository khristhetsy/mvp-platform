import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEALTH_SETTINGS as D,
  alertText,
  classifyCause,
  classifyState,
  decide,
  normalizeSettings,
  type Reading,
} from "./evaluate";

const ok: Reading = { responseMs: 300, probeFailed: false, longestQueryS: 1, newCronTimeouts: 0 };

describe("normalizeSettings", () => {
  it("falls back to defaults for missing or junk input", () => {
    expect(normalizeSettings(null)).toEqual(D);
    expect(normalizeSettings({ warnMs: "fast", overloadMs: -1 })).toEqual(D);
  });
  it("keeps valid overrides", () => {
    const s = normalizeSettings({ warnMs: 1500, overloadMs: 4000, consecutive: 3, queryLimitS: 20, notifyEmail: false });
    expect(s).toMatchObject({ warnMs: 1500, overloadMs: 4000, consecutive: 3, queryLimitS: 20, notifyEmail: false });
  });
  it("keeps the overload limit below the 8 s cutoff and the query limit below 60 s", () => {
    expect(normalizeSettings({ overloadMs: 9000 }).overloadMs).toBe(D.overloadMs);
    expect(normalizeSettings({ queryLimitS: 90 }).queryLimitS).toBe(D.queryLimitS);
  });
  it("resets both limits when warn is not below overload", () => {
    const s = normalizeSettings({ warnMs: 6000, overloadMs: 5000 });
    expect([s.warnMs, s.overloadMs]).toEqual([D.warnMs, D.overloadMs]);
  });
});

describe("classifyState", () => {
  it("is ok inside every limit", () => expect(classifyState(ok, D)).toBe("ok"));
  it("warns at the warning limit", () => expect(classifyState({ ...ok, responseMs: 2000 }, D)).toBe("warn"));
  it("is overload at the overload limit", () => expect(classifyState({ ...ok, responseMs: 5000 }, D)).toBe("overload"));
  it("treats a failed test query as overload", () =>
    expect(classifyState({ ...ok, responseMs: null, probeFailed: true }, D)).toBe("overload"));
  it("warns on a long query or a new job timeout", () => {
    expect(classifyState({ ...ok, longestQueryS: 31 }, D)).toBe("warn");
    expect(classifyState({ ...ok, newCronTimeouts: 1 }, D)).toBe("warn");
  });
  it("ignores job timeouts when that alert is off", () =>
    expect(classifyState({ ...ok, newCronTimeouts: 1 }, { ...D, alertOnCronTimeouts: false })).toBe("ok"));
});

describe("classifyCause", () => {
  it("names the cause from what was seen", () => {
    expect(classifyCause({ ...ok, newCronTimeouts: 2, longestQueryS: 48 }, D)).toBe("jobs_and_queries");
    expect(classifyCause({ ...ok, newCronTimeouts: 1 }, D)).toBe("job_timeout");
    expect(classifyCause({ ...ok, longestQueryS: 48 }, D)).toBe("slow_query");
    expect(classifyCause({ ...ok, responseMs: 7000 }, D)).toBe("slow_response");
  });
});

describe("decide", () => {
  const slow: Reading = { ...ok, responseMs: 7400 };
  it("does not open on a single overload reading", () => {
    expect(decide({ reading: slow, state: "overload", recentStates: ["overload", "ok"], open: null, settings: D })).toEqual({ action: "none" });
  });
  it("opens after the set number of overload readings in a row", () => {
    const d = decide({ reading: slow, state: "overload", recentStates: ["overload", "overload"], open: null, settings: D });
    expect(d).toEqual({ action: "open", cause: "slow_response", peakState: "overload" });
  });
  it("opens at once for a query over the limit", () => {
    const d = decide({ reading: { ...ok, longestQueryS: 48 }, state: "warn", recentStates: ["warn"], open: null, settings: D });
    expect(d).toMatchObject({ action: "open", cause: "slow_query", peakState: "warn" });
  });
  it("opens at once for a new job timeout", () => {
    const d = decide({ reading: { ...ok, newCronTimeouts: 1 }, state: "warn", recentStates: ["warn"], open: null, settings: D });
    expect(d).toMatchObject({ action: "open", cause: "job_timeout" });
  });
  it("updates the peaks while an incident is open", () => {
    const open = { id: 1, peakState: "warn" as const, peakResponseMs: 3000, peakQueryS: 10, cronTimeouts: 1 };
    const d = decide({ reading: { ...slow, longestQueryS: 20, newCronTimeouts: 1 }, state: "overload", recentStates: ["overload", "warn"], open, settings: D });
    expect(d).toEqual({ action: "update", peakState: "overload", peakResponseMs: 7400, peakQueryS: 20, cronTimeouts: 2 });
  });
  it("closes after the set number of ok readings in a row", () => {
    const open = { id: 1, peakState: "overload" as const, peakResponseMs: 7400, peakQueryS: 48, cronTimeouts: 2 };
    expect(decide({ reading: ok, state: "ok", recentStates: ["ok", "ok"], open, settings: D })).toEqual({ action: "close" });
    expect(decide({ reading: ok, state: "ok", recentStates: ["ok", "warn"], open, settings: D }).action).toBe("update");
  });
});

describe("alertText", () => {
  it("names the jobs that timed out", () => {
    const t = alertText({ cause: "job_timeout", peakState: "warn", reading: { ...ok, newCronTimeouts: 1 }, timedOutJobs: ["Social publishing"] });
    expect(t.message).toContain("1 scheduled job timed out (Social publishing)");
  });
  it("says what was seen and where to look", () => {
    const t = alertText({ cause: "jobs_and_queries", peakState: "overload", reading: { responseMs: 7400, probeFailed: false, longestQueryS: 48, newCronTimeouts: 2 } });
    expect(t.title).toBe("Database overloaded: jobs and queries running at once");
    expect(t.message).toBe("The test query took 7.4 s, the longest query has run 48 s, 2 scheduled jobs timed out. Open Database health to see what to do.");
  });
});
