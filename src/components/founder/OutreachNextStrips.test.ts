import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NextBatchStrip, NextManualStepStrip } from "@/components/founder/OutreachNextStrips";
import type { NextBatch } from "@/lib/outreach/outreach-next-batch";

const base: NextBatch = {
  campaignId: "c", companyId: "co", founderId: "f",
  runAt: new Date("2026-10-09T19:00:00Z"),
  investors: [
    { investorRef: "a", name: "Jane Park", matchScore: 60 },
    { investorRef: "b", name: "Northwind Ventures", matchScore: 55 },
    { investorRef: "c", name: "Alder Capital", matchScore: 50 },
    { investorRef: "d", name: "Not Next", matchScore: 40 },
  ],
  upTo: 3, blocked: null, periodCap: 5, reachedThisPeriod: 2,
  periodResetsAt: new Date("2026-10-20T00:00:00Z"), isPublished: true,
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&#x27;|&apos;/g, "'");

describe("outreach strips", () => {
  it("shows the next batch time, who it goes to, and the allowance", () => {
    const t = text(renderToStaticMarkup(createElement(NextBatchStrip, { batch: base })));
    expect(t).toContain("Next batch: Friday, October 9 around 19:00 UTC");
    expect(t).toContain("3 investors: Jane Park, Northwind Ventures and Alder Capital.");
    expect(t).not.toContain("Not Next");
    expect(t).toContain("2 of 5 used this period · resets October 20");
    expect(t).not.toMatch(/\d+%/);
  });

  it("warns when the one-pager isn't published", () => {
    const t = text(renderToStaticMarkup(createElement(NextBatchStrip, { batch: { ...base, blocked: "unpublished" } })));
    expect(t).toContain("Next batch is waiting: your one-pager isn't published");
    expect(t).toContain("Publish one-pager");
  });

  it("shows the next DIY step", () => {
    const t = text(renderToStaticMarkup(createElement(NextManualStepStrip, {
      step: { label: "Follow-up 1", stepIndex: 1, runAt: new Date("2026-10-10T07:00:00Z"), recipients: 4 },
    })));
    expect(t).toContain("Next sequence step: Follow-up 1 on Saturday, October 10");
    expect(t).toContain("Goes to 4 investors around 07:00 UTC");
  });
});
