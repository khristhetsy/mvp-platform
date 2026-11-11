import { describe, expect, it } from "vitest";
import { MAX_RESULT_PAGES, READ_GAP_MINUTES, READ_PAGES_PER_DAY, afterFailedRead, afterRead, canReadNow, cleanSlug, EMPTY_PROGRESS, isNetworkAudience, isSearchUrl, needsFilterPanel, readNetworkFilters, readProgress } from "./network";

const NOW = new Date("2026-11-09T18:00:00Z"); // 10:00 Monday in Los Angeles
const TZ = "America/Los_Angeles";

describe("network audience", () => {
  it("recognises it and reads filters safely", () => {
    expect(isNetworkAudience({ source: "linkedin_network" })).toBe(true);
    expect(isNetworkAudience({ source: "crm" })).toBe(false);
    expect(readNetworkFilters({ filters: { industry: " Banking ", school: "", sort: "bogus", name: 5 } })).toEqual({ industry: ["Banking"], sort: "recent" });
    expect(readNetworkFilters({ filters: { sort: "last" } }).sort).toBe("last");
  });
  it("needs the filter panel only for facets or a sort", () => {
    expect(needsFilterPanel({ sort: "recent", name: "Ana" })).toBe(false);
    expect(needsFilterPanel({ sort: "recent", school: ["MIT"] })).toBe(true);
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

import { matchesTitles, readNetworkFilters as readF, readTitles } from "./network";

describe("titles to keep", () => {
  it("keeps everyone when no titles are set", () => {
    expect(matchesTitles("Plumber", undefined)).toBe(true);
    expect(matchesTitles(null, [])).toBe(true);
  });
  it("matches whole words in the headline, ignoring case", () => {
    expect(matchesTitles("Co-Founder at Acme", ["Founder"])).toBe(true);
    expect(matchesTitles("ceo and owner", ["CEO"])).toBe(true);
    expect(matchesTitles("Foundersville mayor", ["Founder"])).toBe(false);
    expect(matchesTitles("Senior Engineer", ["Founder", "CEO"])).toBe(false);
  });
  it("skips people with no headline when titles are set", () => {
    expect(matchesTitles(null, ["Founder"])).toBe(false);
  });
  it("cleans the list: trims, drops duplicates, caps length and count", () => {
    expect(readTitles([" Founder ", "founder", "", 5, "CEO"])).toEqual(["Founder", "CEO"]);
    expect(readTitles(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(12);
    expect(readTitles("x")).toEqual([]);
  });
  it("reads titles from the campaign filters", () => {
    expect(readF({ filters: { titles: ["CEO"] } }).titles).toEqual(["CEO"]);
    expect(readF({ filters: { titles: [] } }).titles).toBeUndefined();
  });
});

import { matchKey as mk, matchState, readMatchCheck } from "./network";

describe("matches on LinkedIn count", () => {
  const base = { id: "c1", status: "pending", requestedAt: "2026-11-10T10:00:00Z", key: "k", filters: { industry: ["Venture"], sort: "recent" }, total: null, detail: null, doneAt: null };
  it("keys only the filters LinkedIn counts with, ignoring case and spaces", () => {
    expect(mk({ industry: " Venture ", titles: ["CEO"], sort: "first" })).toBe(mk({ industry: "venture" }));
    expect(mk({ industry: "a" })).not.toBe(mk({ industry: "b" }));
    expect(mk({ name: "Ann" })).not.toBe(mk({ school: "Ann" }));
  });
  it("keys several values the same whatever their order, and one value the same as the old single text", () => {
    expect(mk({ industry: ["Banking", "Insurance"] })).toBe(mk({ industry: ["insurance", " Banking "] }));
    expect(mk({ industry: ["Banking"] })).toBe(mk({ industry: "Banking" }));
    expect(mk({ industry: ["Banking", "Insurance"] })).not.toBe(mk({ industry: ["Banking"] }));
  });
  it("reads a stored check safely", () => {
    expect(readMatchCheck(null)).toBeNull();
    expect(readMatchCheck({ id: 1 })).toBeNull();
    expect(readMatchCheck({ ...base, status: "weird" })).toBeNull();
    expect(readMatchCheck({ ...base, status: "done", total: 240.7 })?.total).toBe(240);
    expect(readMatchCheck({ ...base, total: -3 })?.total).toBeNull();
  });
  it("is pending for 10 minutes, then unanswered", () => {
    const mc = readMatchCheck(base);
    expect(matchState(null, new Date("2026-11-10T10:01:00Z"))).toBe("none");
    expect(matchState(mc, new Date("2026-11-10T10:09:00Z"))).toBe("pending");
    expect(matchState(mc, new Date("2026-11-10T10:11:00Z"))).toBe("unanswered");
    expect(matchState(readMatchCheck({ ...base, status: "done", total: 5 }), new Date("2026-11-10T12:00:00Z"))).toBe("done");
  });
});

import { forExtension, isExtensionFresh } from "./network";
import { MAX_FILTER_VALUES } from "./limits";

describe("filters with several values", () => {
  it("reads a list, an old single text, and cleans both", () => {
    const f = readNetworkFilters({ filters: { industry: [" Banking ", "banking", "", "Insurance"], locations: "France", school: [] } });
    expect(f.industry).toEqual(["Banking", "Insurance"]);
    expect(f.locations).toEqual(["France"]);
    expect(f.school).toBeUndefined();
  });
  it("keeps at most 10 values of 80 characters per filter", () => {
    const many = Array.from({ length: 15 }, (_, i) => `Company ${i}`);
    expect(readNetworkFilters({ filters: { currentCompany: many } }).currentCompany).toHaveLength(MAX_FILTER_VALUES);
    expect(readNetworkFilters({ filters: { school: ["x".repeat(200)] } }).school?.[0]).toHaveLength(80);
  });
  it("opens the filter panel for a list too", () => {
    expect(needsFilterPanel({ sort: "recent", industry: ["Banking", "Insurance"] })).toBe(true);
    expect(needsFilterPanel({ sort: "recent", industry: [] })).toBe(false);
  });
  it("sends one value as plain text, so extensions installed before 0.2.0 keep working, and several as a list", () => {
    expect(forExtension({ sort: "recent", industry: ["Banking"], locations: ["France", "United States"] })).toEqual({ sort: "recent", industry: "Banking", locations: ["France", "United States"] });
  });
});

describe("extension detected", () => {
  const now = new Date("2026-11-11T10:00:00Z");
  it("is connected when it asked within 15 minutes", () => {
    expect(isExtensionFresh("2026-11-11T09:50:00Z", true, now)).toBe(true);
    expect(isExtensionFresh("2026-11-11T09:44:00Z", true, now)).toBe(false);
  });
  it("is not detected without a key or a first visit", () => {
    expect(isExtensionFresh("2026-11-11T09:59:00Z", false, now)).toBe(false);
    expect(isExtensionFresh(null, true, now)).toBe(false);
    expect(isExtensionFresh("not a date", true, now)).toBe(false);
  });
});
