import { describe, expect, it } from "vitest";
import { MAX_RESULT_PAGES, READ_GAP_MINUTES, READ_PAGES_PER_DAY, afterFailedRead, afterRead, canReadNow, cleanSlug, EMPTY_PROGRESS, isNetworkAudience, isSearchUrl, needsFilterPanel, readNetworkFilters, readProgress } from "./network";

const NOW = new Date("2026-11-09T18:00:00Z"); // 10:00 Monday in Los Angeles
const TZ = "America/Los_Angeles";

describe("network audience", () => {
  it("recognises it and reads filters safely", () => {
    expect(isNetworkAudience({ source: "linkedin_network" })).toBe(true);
    expect(isNetworkAudience({ source: "crm" })).toBe(false);
    expect(readNetworkFilters({ filters: { industry: " Banking ", school: "", sort: "bogus", name: 5 } })).toEqual({ industry: "Banking", sort: "recent" });
    expect(readNetworkFilters({ filters: { sort: "last" } }).sort).toBe("last");
  });
  it("needs the filter panel only for facets or a sort", () => {
    expect(needsFilterPanel({ sort: "recent", name: "Ana" })).toBe(false);
    expect(needsFilterPanel({ sort: "recent", school: "MIT" })).toBe(true);
    expect(needsFilterPanel({ sort: "first" })).toBe(true);
  });
  it("only follows LinkedIn people search addresses", () => {
    expect(isSearchUrl("https://www.linkedin.com/search/results/people/?network=%5B%22F%22%5D")).toBe(true);
    expect(isSearchUrl("https://evil.com/search/results/people/")).toBe(false);
    expect(isSearchUrl("http://www.linkedin.com/search/results/people/")).toBe(false);
    expect(isSearchUrl("https://www.linkedin.com/feed/")).toBe(false);
    expect(isSearchUrl(null)).toBe(false);
  });
  it("cleans profile slugs and drops hidden ids", () => {
    expect(cleanSlug("https://www.linkedin.com/in/Ana-Lopez-123/?miniProfileUrn=x")).toBe("ana-lopez-123");
    expect(cleanSlug("ana-lopez")).toBe("ana-lopez");
    expect(cleanSlug("ACoAAAbcdefghijklmnopqrstuv")).toBeNull();
    expect(cleanSlug("")).toBeNull();
    expect(cleanSlug("not a slug!")).toBeNull();
  });
  it("reads progress with safe defaults", () => {
    expect(readProgress({})).toEqual(EMPTY_PROGRESS);
    expect(readProgress({ progress: { page: -3, found: "x", searchUrl: "https://evil.com" } })).toMatchObject({ page: 1, found: 0, searchUrl: null });
  });
});

describe("when to read", () => {
  it("reads when people are needed", () => {
    expect(canReadNow({ progress: EMPTY_PROGRESS, queued: 0, now: NOW, timeZone: TZ })).toEqual({ ok: true });
  });
  it("stops when done, when enough wait, after the daily pages, and inside the gap", () => {
    expect(canReadNow({ progress: { ...EMPTY_PROGRESS, done: true }, queued: 0, now: NOW, timeZone: TZ })).toEqual({ ok: false, reason: "done" });
    expect(canReadNow({ progress: { ...EMPTY_PROGRESS, page: MAX_RESULT_PAGES + 1 }, queued: 0, now: NOW, timeZone: TZ })).toEqual({ ok: false, reason: "done" });
    expect(canReadNow({ progress: EMPTY_PROGRESS, queued: 10, now: NOW, timeZone: TZ })).toEqual({ ok: false, reason: "enough_queued" });
    const day = "2026-11-09T08:00:00.000Z";
    expect(canReadNow({ progress: { ...EMPTY_PROGRESS, readDay: day, readToday: READ_PAGES_PER_DAY, readAt: "2026-11-09T09:00:00Z" }, queued: 0, now: NOW, timeZone: TZ })).toEqual({ ok: false, reason: "daily_reads" });
    expect(canReadNow({ progress: { ...EMPTY_PROGRESS, readDay: day, readToday: 1, readAt: new Date(NOW.getTime() - (READ_GAP_MINUTES - 1) * 60_000).toISOString() }, queued: 0, now: NOW, timeZone: TZ })).toEqual({ ok: false, reason: "read_gap" });
  });
  it("resets the daily count on a new day", () => {
    const yesterday = "2026-11-08T08:00:00.000Z";
    expect(canReadNow({ progress: { ...EMPTY_PROGRESS, readDay: yesterday, readToday: 3, readAt: "2026-11-08T20:00:00Z" }, queued: 0, now: NOW, timeZone: TZ })).toEqual({ ok: true });
  });
});

describe("after a read", () => {
  it("moves on and counts the page", () => {
    const p = afterRead(EMPTY_PROGRESS, { page: 1, added: 7, seen: 10, searchUrl: "https://www.linkedin.com/search/results/people/?x=1", now: NOW, timeZone: TZ });
    expect(p).toMatchObject({ page: 2, found: 7, done: false, readToday: 1, searchUrl: "https://www.linkedin.com/search/results/people/?x=1" });
    expect(afterRead(p, { page: 2, added: 3, seen: 10, now: NOW, timeZone: TZ })).toMatchObject({ page: 3, found: 10, readToday: 2, searchUrl: p.searchUrl });
  });
  it("ends on an empty page or the last page", () => {
    expect(afterRead(EMPTY_PROGRESS, { page: 4, added: 0, seen: 0, now: NOW, timeZone: TZ }).done).toBe(true);
    expect(afterRead(EMPTY_PROGRESS, { page: MAX_RESULT_PAGES, added: 5, seen: 10, now: NOW, timeZone: TZ }).done).toBe(true);
  });
  it("keeps the page after a failed read but still counts it against the day", () => {
    const p = afterFailedRead({ ...EMPTY_PROGRESS, page: 3 }, NOW, TZ);
    expect(p).toMatchObject({ page: 3, readToday: 1 });
    expect(p.readAt).toBe(NOW.toISOString());
  });
});
