import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/fit/match-investors", () => ({ matchInvestors: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/sales/contacts", () => ({ appendContactNote: vi.fn() }));

import { answersToFit, buildMatchNote, raiseKeysFor } from "./booking-matches";
import { bookingEmail } from "./notify";

const answers = [
  { label: "Raising or investing", value: "Raising" },
  { label: "Company stage", value: "Pre revenue" },
  { label: "Industry", value: "Saas" },
  { label: "Raise size", value: "$1M to $5M" },
  { label: "Time to close", value: "A few months" },
];

describe("raiseKeysFor", () => {
  it("maps ranges onto /fit raise bands", () => {
    expect(raiseKeysFor("$1M to $5M")).toEqual(["1m_10m"]);
    expect(raiseKeysFor("Under $1M")).toEqual(["under_1m"]);
    expect(raiseKeysFor("$500k to $2M")).toEqual(["under_1m", "1m_10m"]);
    expect(raiseKeysFor("Over $10M")).toEqual(["over_10m"]);
    expect(raiseKeysFor("not sure")).toEqual([]);
  });
});

describe("answersToFit", () => {
  it("builds matcher inputs for a founder raising", () => {
    expect(answersToFit(answers)).toEqual({
      stage: ["pre_revenue"], raise: ["1m_10m"], industry: ["SaaS"], revenue: ["pre_revenue"], investorType: [],
    });
  });
  it("skips investors and bookings without an industry", () => {
    expect(answersToFit([{ label: "Raising or investing", value: "Investing" }, { label: "Industry", value: "SaaS" }])).toBeNull();
    expect(answersToFit(answers.filter((a) => a.label !== "Industry"))).toBeNull();
  });
});

describe("buildMatchNote", () => {
  it("lists the shown matches and the booking id", () => {
    const note = buildMatchNote({
      bookingId: "b1", answers,
      result: { total: 24, matches: [{ company: "21 Warrior Ventures", fit: 100, detail: "x" }, { company: "A.J. Rounds", fit: 100, detail: "y" }] },
      when: new Date("2026-10-26T18:00:00Z"),
    });
    expect(note).toContain("Booking match review (10/26/2026 11:00 AM PT)");
    expect(note).toContain("Raise: $1M to $5M");
    expect(note).toContain("2 of 24 matched investors shown to host:");
    expect(note).toContain("1. 21 Warrior Ventures (100%)");
    expect(note).toContain("Booking: b1");
  });
});

describe("bookingEmail investor matches", () => {
  const base = {
    greetingName: "Khris", heroTitle: "New event scheduled", heroSub: "x", title: "Intro call", inviteeName: "K", inviteeEmail: "k@x.com",
    whenText: "now", timezone: "America/Los_Angeles", durationMin: 30, meetUrl: null, answers, addToCalUrl: "https://x", cancelUrl: null, rescheduleUrl: null,
  };
  it("shows matches when provided and omits the block otherwise", () => {
    const withM = bookingEmail({ ...base, investorMatches: { total: 24, matches: [{ company: "21 Warrior Ventures", fit: 100, detail: "Venture fund" }] } }).html;
    expect(withM).toContain("Investor matches (top 1 of 24)");
    expect(withM).toContain("21 Warrior Ventures");
    expect(withM).toContain("100% fit");
    expect(bookingEmail(base).html).not.toContain("Investor matches");
  });
});
