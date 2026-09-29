import { describe, it, expect } from "vitest";
import { rollupCampaigns, type Campaign } from "./campaigns";
import { taggedLink } from "./queue";

const camps: Campaign[] = [
  { id: "c1", name: "Raise sequence", budget_cents: 320000, source_tag: "camp_aaa" },
  { id: "c2", name: "Webinar teaser", budget_cents: 90000, source_tag: "camp_bbb" },
  { id: "c3", name: "No budget", budget_cents: 0, source_tag: "camp_ccc" },
];

describe("rollupCampaigns", () => {
  it("computes posts/published/signups/members/revenue and ROI", () => {
    const out = rollupCampaigns(
      camps,
      new Map([["c1", 5], ["c2", 2]]),
      new Map([["c1", 4], ["c2", 1]]),
      new Map([
        ["camp_aaa", { signups: 12, members: 4, revenueCents: 400000 }],
        ["camp_bbb", { signups: 3, members: 0, revenueCents: 0 }],
      ]),
    );
    const c1 = out.find((c) => c.id === "c1")!;
    expect(c1.posts).toBe(5);
    expect(c1.published).toBe(4);
    expect(c1.signups).toBe(12);
    expect(c1.members).toBe(4);
    expect(c1.revenue_cents).toBe(400000);
    expect(c1.roi).toBeCloseTo(400000 / 320000); // 1.25×

    const c2 = out.find((c) => c.id === "c2")!;
    expect(c2.roi).toBeCloseTo(0); // 0 revenue / 90000 budget

    const c3 = out.find((c) => c.id === "c3")!;
    expect(c3.roi).toBeNull(); // no budget → ROI undefined
    expect(c3.signups).toBe(0);
  });
});

describe("taggedLink", () => {
  it("appends the campaign tag as ?s=", () => {
    expect(taggedLink("https://icapos.com/fit", "camp_aaa")).toBe("https://icapos.com/fit?s=camp_aaa");
  });
  it("does not override an existing s param, and no-ops without a tag/url", () => {
    expect(taggedLink("https://icapos.com/fit?s=keep", "camp_aaa")).toBe("https://icapos.com/fit?s=keep");
    expect(taggedLink(null, "camp_aaa")).toBeNull();
    expect(taggedLink("https://icapos.com/fit", null)).toBe("https://icapos.com/fit");
  });
  it("leaves a non-URL string unchanged", () => {
    expect(taggedLink("not a url", "camp_aaa")).toBe("not a url");
  });
});
