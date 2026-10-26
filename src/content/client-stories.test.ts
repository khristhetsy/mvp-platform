import { describe, expect, it } from "vitest";
import {
  approvedStories,
  clientStories,
  isIsoDate,
  MIN_STORIES_FOR_SUMMARY,
  rangeLabel,
  storiesSummary,
  storyApproved,
  type ClientStory,
} from "./client-stories";

const cynthia = clientStories.find((s) => s.slug === "cynthia-mcbreen") as ClientStory;
const approved = (s: ClientStory): ClientStory => ({ ...s, approvedOn: "2026-10-27" });

describe("client stories", () => {
  it("lists a story only while its permission date is set", () => {
    expect(storyApproved(cynthia)).toBe(true);
    const drafts = clientStories.map((s) => ({ ...s, approvedOn: "" }));
    for (const d of drafts) expect(storyApproved(d)).toBe(false);
    expect(approvedStories(drafts)).toEqual([]);
    const mixed = [cynthia, ...drafts.slice(1)];
    expect(approvedStories(mixed).map((s) => s.slug)).toEqual([cynthia.slug]);
  });

  it("is hidden without a permission date", () => {
    expect(storyApproved({ ...cynthia, approvedOn: "" })).toBe(false);
  });

  it("is hidden when the permission date is a placeholder or not a real date", () => {
    for (const bad of ["2026-MM-DD", "TBD", "10/27/2026", "2026-10-7", "2026-02-30", "2026-13-01", " "]) {
      expect(storyApproved({ ...cynthia, approvedOn: bad })).toBe(false);
    }
    expect(storyApproved({ ...cynthia, approvedOn: "2026-10-27" })).toBe(true);
  });

  it("accepts only YYYY-MM-DD calendar dates", () => {
    expect(isIsoDate("2026-10-27")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2025-02-29")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it("carries a rising score pair wherever both scores are given", () => {
    for (const s of clientStories) {
      if (typeof s.crrStart === "number") expect(s.crrCurrent).toBeGreaterThan(s.crrStart);
    }
  });

  it("points photos and logos at files kept in public/marketing/clients", () => {
    for (const s of clientStories) {
      expect(s.photoUrl).toMatch(/^\/marketing\/clients\//);
      if (s.logoUrl) expect(s.logoUrl).toMatch(/^\/marketing\/clients\//);
    }
  });

  it("spells the company as Impervitex Corp.", () => {
    expect(cynthia.company).toBe("Impervitex Corp.");
  });

  it("gives every story three cards, two quotes and a snapshot", () => {
    for (const s of clientStories) {
      expect(s.story).toHaveLength(3);
      expect(s.pullQuotes).toHaveLength(2);
      expect(s.snapshot.length).toBeGreaterThan(0);
      expect(s.recommendScore).toBeGreaterThanOrEqual(0);
      expect(s.recommendScore).toBeLessThanOrEqual(10);
    }
  });
});

describe("stories summary", () => {
  it("stays hidden below the minimum number of approved stories", () => {
    expect(storiesSummary(clientStories.map((s) => ({ ...s, approvedOn: "" })))).toBeNull();
    expect(storiesSummary(clientStories.map(approved).slice(0, MIN_STORIES_FOR_SUMMARY - 1))).toBeNull();
  });

  it("totals only the approved stories once the minimum is met", () => {
    const sum = storiesSummary(clientStories.map(approved));
    expect(sum).not.toBeNull();
    expect(sum?.total).toBe(clientStories.length);
    expect(sum?.ratedTen).toBe(clientStories.filter((s) => s.recommendScore === 10).length);
    expect(sum?.crrMin).toBe(Math.min(...clientStories.map((s) => s.crrCurrent)));
    expect(sum?.crrMax).toBe(Math.max(...clientStories.map((s) => s.crrCurrent)));
    expect(sum?.weeksMin).toBe(1);
    expect(sum?.weeksMax).toBe(3);
  });

  it("does not count a draft toward the minimum", () => {
    const list = clientStories.map((s, i) => (i === 0 ? s : approved(s)));
    const withDraft = [...list.slice(0, 2), { ...clientStories[2], approvedOn: "" }];
    expect(storiesSummary(withDraft)).toBeNull();
  });

  it("formats a range, collapsing equal ends", () => {
    expect(rangeLabel(84, 91)).toBe("84 to 91");
    expect(rangeLabel(3, 3)).toBe("3");
  });
});
