import { describe, it, expect } from "vitest";
import { cleanFollowUps, followUpSteps, MAX_FOLLOW_UPS, MAX_FOLLOW_UP_DELAY_DAYS } from "./campaign-follow-ups";

describe("cleanFollowUps", () => {
  it("returns an empty list for anything that is not an array", () => {
    expect(cleanFollowUps(undefined)).toEqual([]);
    expect(cleanFollowUps("x")).toEqual([]);
    expect(cleanFollowUps({})).toEqual([]);
  });

  it("keeps valid entries and defaults an unknown condition to no_reply", () => {
    expect(cleanFollowUps([
      { template_id: "t1", delay_days: 3, condition: "no_open" },
      { template_id: "t2", delay_days: 5, condition: "bogus" },
    ])).toEqual([
      { template_id: "t1", delay_days: 3, condition: "no_open" },
      { template_id: "t2", delay_days: 5, condition: "no_reply" },
    ]);
  });

  it("drops entries with no template or a bad delay", () => {
    expect(cleanFollowUps([
      { template_id: "", delay_days: 3 },
      { template_id: "t1", delay_days: -1 },
      { template_id: "t1", delay_days: "soon" },
      null,
      7,
    ])).toEqual([]);
  });

  it("caps the delay and the number of follow ups", () => {
    const many = Array.from({ length: MAX_FOLLOW_UPS + 3 }, () => ({ template_id: "t", delay_days: 999, condition: "always" }));
    const out = cleanFollowUps(many);
    expect(out).toHaveLength(MAX_FOLLOW_UPS);
    expect(out[0].delay_days).toBe(MAX_FOLLOW_UP_DELAY_DAYS);
  });
});

describe("followUpSteps", () => {
  it("numbers steps from 1 and copies the sender", () => {
    const steps = followUpSteps(
      [{ template_id: "a", delay_days: 3, condition: "no_reply" }, { template_id: "b", delay_days: 5, condition: "always" }],
      "seq1",
      { from_name: "iCapOS", from_email: "outreach@icapos.com" },
    );
    expect(steps.map((s) => s.step_order)).toEqual([1, 2]);
    expect(steps[0]).toMatchObject({ sequence_id: "seq1", template_id: "a", delay_days: 3, from_email: "outreach@icapos.com" });
  });
});
