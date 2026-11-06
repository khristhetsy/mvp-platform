import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrivateMarketExperience } from "@/components/marketing/PrivateMarketExperience";
import type { ListingBoardStats } from "@/components/marketing/PrivateMarketListings";
import type { MarketBoardData } from "@/lib/data/market-board";
import type { ListedCompany } from "@/lib/listing/private-market";

const co = (id: string, name: string, extra: Partial<ListedCompany> = {}): ListedCompany => ({
  id, name, industry: "Fintech", stage: "Seed", location: null, raising: "Raising $2M", description: null, crr: 80,
  listedAt: "2026-10-01T00:00:00Z", revenueStage: "pre_revenue", mrr: "Under $10k", optedIn: false, ...extra,
});
const stat = (extra: Partial<ListingBoardStats> = {}): ListingBoardStats => ({
  crrChange: 10, firstAt: "2026-09-18T00:00:00Z", outreachTotal: 5, outreachChange: 2, match: 72, ...extra,
});
const delta = (value: number) => ({ value, change: 1, pct: 10 });
const board: MarketBoardData = {
  asOf: "2026-11-06T12:00:00Z",
  tiles: { avgCrr: delta(58), founders: delta(22), strong: delta(12), moderate: delta(3), building: delta(7), windowDays: 7, from: "2026-10-30T00:00:00Z", to: "2026-11-06T00:00:00Z" },
  candles: [{ weekStart: "2026-11-02", open: 50, high: 60, low: 49, close: 58, readings: 4 }],
  movingAverage: [null],
  sectors: [{ sector: "Fintech", avg: 76.5, change: 0.4 }],
  outreach: { total: 131, change: 17, windowDays: 7 },
  byCompany: {},
};

const render = (canRequest: boolean, withBoard = true) =>
  renderToStaticMarkup(
    createElement(PrivateMarketExperience, {
      companies: [co("a", "Alpha Co", { optedIn: true }), co("b", "Beta Co", { crr: null })],
      stats: { a: stat(), b: stat({ crrChange: null, match: null }) },
      board: withBoard ? board : null,
      canRequest,
      outreachWindowDays: 30,
    }),
  );

describe("PrivateMarketExperience", () => {
  it("lists every approved company with its opt in status and counts", () => {
    const html = render(true);
    expect(html).toContain("Alpha Co");
    expect(html).toContain("Beta Co");
    expect(html).toContain("OPTED IN");
    expect(html).toContain("APPROVED · NOT OPTED IN");
    expect(html).toContain("2 APPROVED · 1 OPTED IN");
  });
  it("shows the match for each company and n/a when there is none", () => {
    const html = render(true);
    expect(html).toContain("72%");
    expect(html).toContain("n/a");
  });
  it("renders the board sector row as a button and the table without the board when it failed to load", () => {
    expect(render(true)).toContain("Show only Fintech companies");
    const noBoard = render(true, false);
    expect(noBoard).not.toContain("Show only Fintech companies");
    expect(noBoard).toContain("Alpha Co");
  });
  it("has no TRACTION column and no logo tile on the board", () => {
    const html = render(true);
    expect(html).not.toContain("TRACTION");
    expect(html).not.toContain(`alt="iCapOS"`);
    expect(html).toContain("AVG CRR");
  });
  it("does not open a one pager until a company is chosen", () => {
    expect(render(false)).not.toContain("COMPANY ONE PAGER");
  });
});
