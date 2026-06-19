import { describe, it, expect } from "vitest";
import { fallbackCoachingSummary } from "./coaching";
import type { PartnerRecommendation } from "./recommendations";

function rec(title: string): PartnerRecommendation {
  return { pillar: "followThrough", priority: 10, title, detail: "" };
}

describe("fallbackCoachingSummary", () => {
  it("praises a strong investor when there are no recommendations", () => {
    const summary = fallbackCoachingSummary([]);
    expect(summary.toLowerCase()).toContain("strong partner");
  });

  it("names the top recommendation when there is one", () => {
    const summary = fallbackCoachingSummary([rec("Reply to founders more promptly")]);
    expect(summary.toLowerCase()).toContain("reply to founders more promptly");
  });

  it("joins the top two recommendations with 'and'", () => {
    const summary = fallbackCoachingSummary([
      rec("Follow through on the deals you're interested in"),
      rec("Reply to founders more promptly"),
      rec("Strengthen your investor profile"),
    ]);
    expect(summary).toContain(", and ");
    // only the top two are surfaced, not the third
    expect(summary.toLowerCase()).not.toContain("strengthen your investor profile");
  });
});
