import { describe, expect, it } from "vitest";
import {
  bucketOf,
  callTaskText,
  cohortKeys,
  decideFollowup,
  followupSubject,
  regionOf,
  renderFollowupEmail,
  variantFor,
  type FollowupState,
} from "./sequence";
import { renderFounderEmail, WARM_INTRO_LINE } from "./email";
import { readMatchConfig } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const t0 = new Date("2026-10-05T09:00:00Z");
const at = (days: number) => new Date(t0.getTime() + days * DAY);

const state = (over: Partial<FollowupState> = {}): FollowupState => ({
  sent_at: t0.toISOString(),
  opened_page_at: null,
  clicked_intro_at: null,
  booked_at: null,
  plan_started_at: null,
  replied_at: null,
  unsubscribed: false,
  followup_branch: "a",
  followup_step: 0,
  ...over,
});

describe("decideFollowup", () => {
  it("waits until Day 3 for Branch A", () => {
    const d = decideFollowup(state(), at(1));
    expect(d).toEqual({ action: "wait", branch: "a", stepIndex: 0, at: at(3).toISOString() });
  });
  it("sends Branch A Day 3, then Day 10, then completes", () => {
    expect(decideFollowup(state(), at(3))).toMatchObject({ action: "send", step: { key: "a1" } });
    expect(decideFollowup(state({ followup_step: 1 }), at(4))).toMatchObject({ action: "wait", at: at(10).toISOString() });
    expect(decideFollowup(state({ followup_step: 1 }), at(10))).toMatchObject({ action: "send", step: { key: "a2" } });
    expect(decideFollowup(state({ followup_step: 2 }), at(11))).toEqual({ action: "complete", branch: "a" });
  });
  it("moves a founder who opened the page to Branch B, timed from the view", () => {
    const viewed = at(5).toISOString();
    const s = state({ followup_step: 1, opened_page_at: viewed });
    expect(decideFollowup(s, at(6))).toEqual({ action: "wait", branch: "b", stepIndex: 0, at: at(7).toISOString() });
    expect(decideFollowup(s, at(7))).toMatchObject({ action: "send", branch: "b", stepIndex: 0, step: { key: "b1" } });
  });
  it("runs Branch B: email, call task, email", () => {
    const viewed = at(1).toISOString();
    const b = (step: number) => state({ followup_branch: "b", followup_step: step, opened_page_at: viewed });
    expect(decideFollowup(b(1), at(4))).toMatchObject({ action: "send", step: { key: "b2", channel: "call" } });
    expect(decideFollowup(b(2), at(8))).toMatchObject({ action: "send", step: { key: "b3" } });
    expect(decideFollowup(b(3), at(9))).toEqual({ action: "complete", branch: "b" });
  });
  it("stops on intro, booking, plan, reply or unsubscribe", () => {
    expect(decideFollowup(state({ clicked_intro_at: t0.toISOString() }), at(3))).toEqual({ action: "stop", reason: "intro_requested" });
    expect(decideFollowup(state({ booked_at: t0.toISOString() }), at(3))).toEqual({ action: "stop", reason: "booked" });
    expect(decideFollowup(state({ plan_started_at: t0.toISOString() }), at(3))).toEqual({ action: "stop", reason: "plan_started" });
    expect(decideFollowup(state({ replied_at: t0.toISOString() }), at(3))).toEqual({ action: "stop", reason: "replied" });
    expect(decideFollowup(state({ unsubscribed: true }), at(3))).toEqual({ action: "stop", reason: "unsubscribed" });
  });
});

describe("cohorts and holdout", () => {
  it("groups regions", () => {
    expect(regionOf("United States")).toBe("US");
    expect(regionOf("Mexico")).toBe("LatAm");
    expect(regionOf("Singapore")).toBe("Asia");
    expect(regionOf("Canada")).toBe("Canada");
    expect(regionOf("Australia")).toBe("Other");
    expect(regionOf(null)).toBe("Unknown region");
  });
  it("keys cohorts by industry, stage and region and splits over the cap", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      industry: "Fintech, Payments",
      funding_stage: "Seed Round",
      country: "United States",
    }));
    rows.push({ id: "ffffffff-0000-4000-8000-000000000000", industry: "Biotech", funding_stage: "Pre-Seed", country: "Canada" });
    const keys = cohortKeys(rows, 10);
    expect(keys.get(rows[0].id)).toBe("Fintech · Seed · US · 1");
    expect(keys.get(rows[11].id)).toBe("Fintech · Seed · US · 2");
    expect(keys.get("ffffffff-0000-4000-8000-000000000000")).toMatch(/^Biotech · .+ · Canada$/);
  });
  it("splits deterministically and respects 0% and the percentage roughly", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(variantFor(id, 50)).toBe(variantFor(id, 50));
    expect(variantFor(id, 0)).toBe("sequence");
    const ids = Array.from({ length: 2000 }, (_, i) => `id-${i}`);
    const single = ids.filter((x) => variantFor(x, 50) === "single").length;
    expect(single).toBeGreaterThan(900);
    expect(single).toBeLessThan(1100);
    expect(bucketOf("x")).toBeGreaterThanOrEqual(0);
  });
});

describe("follow up emails", () => {
  const input = {
    company: "NanoRetinal",
    matchCount: 6,
    day0MatchCount: 6,
    topInvestor: { name: "Ben Paulo", focus: "Medical Devices at Pre-seed", views: 2 },
    links: { matches: "https://icapos.com/matches/t", intro: "https://icapos.com/mc/t?a=intro" },
    postalAddress: "iCFO Capital Global, Inc., La Jolla, CA",
  };
  it("says one more matched only when the count grew", () => {
    expect(renderFollowupEmail("a1", input)).toContain("Your 6 investor matches for NanoRetinal are ready");
    expect(renderFollowupEmail("a1", { ...input, matchCount: 7 })).toContain("One more investor matched NanoRetinal");
    expect(renderFollowupEmail("a1", input)).toContain("See my 6 matches");
  });
  it("names the most viewed investor, without 'you looked at' when never viewed", () => {
    expect(renderFollowupEmail("b1", input)).toContain("You looked at Ben Paulo&#39;s profile twice".replace("&#39;", "'"));
    const none = renderFollowupEmail("b1", { ...input, topInvestor: { ...input.topInvestor, views: 0 } }) ?? "";
    expect(none).toContain("Ben Paulo is your top match");
    expect(none).not.toContain("You looked at");
    expect(renderFollowupEmail("b1", input)).toContain("Request intro to Ben Paulo");
  });
  it("has no email for the call step and links the plan on b3", () => {
    expect(renderFollowupEmail("b2", input)).toBeNull();
    expect(renderFollowupEmail("b3", input)).toContain("https://icapos.com/mc/t?a=intro");
  });
  it("replies in the Day 0 thread", () => {
    expect(followupSubject("6 investors match NanoRetinal")).toBe("Re: 6 investors match NanoRetinal");
    expect(followupSubject("Re: x")).toBe("Re: x");
  });
  it("writes a call task with the opener", () => {
    const t = callTaskText({ company: "NanoRetinal", matchCount: 6, topInvestor: "Ben Paulo" });
    expect(t.title).toBe("Match review call · NanoRetinal");
    expect(t.summary).toContain("Ben Paulo");
  });
});

describe("Day 0 layout and config", () => {
  const base = {
    company: "NanoRetinal",
    industry: "Biotech",
    stages: ["Pre-Seed"],
    matchCount: 6,
    top: [],
    networkLabel: "7,000+",
    basicPrice: "$49/mo",
    links: { matches: "https://icapos.com/matches/t", call: "https://icapos.com/mc/t?a=call", plan: "https://icapos.com/mc/t?a=intro", privacy: "https://icapos.com/privacy" },
    postalAddress: "iCFO Capital Global, Inc.",
  };
  it("classic layout is unchanged: two buttons, no warm intro line", () => {
    const html = renderFounderEmail(base);
    expect(html).toContain("Schedule a call with us");
    expect(html).toContain("Choose a plan to unlock");
    expect(html).not.toContain(WARM_INTRO_LINE.slice(0, 30));
  });
  it("matches first layout has one button to the match page and the warm intro line", () => {
    const html = renderFounderEmail({ ...base, layout: "matches_first" });
    expect(html).toContain("See my 6 matches");
    expect(html).toContain("You can see who. We get you the meeting");
    expect(html).not.toContain("Schedule a call with us");
    expect(html).not.toContain("?a=call");
  });
  it("sequence settings default off and clamp", () => {
    const c = readMatchConfig({});
    expect(c.sequence_enabled).toBe(false);
    expect(c.cohort_cap).toBe(50);
    expect(c.holdout_pct).toBe(50);
    expect(readMatchConfig({ cohort_cap: 500, holdout_pct: 120 })).toMatchObject({ cohort_cap: 100, holdout_pct: 90 });
  });
});
