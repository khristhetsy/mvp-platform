import { describe, expect, it } from "vitest";
import {
  bareNumber,
  checkOf,
  declinesTimes,
  fitAnswersFor,
  industryOf,
  isSideTalk,
  moneyIn,
  nameFromEmail,
  raiseOf,
  roleOf,
  slotsFor,
  stageOf,
  timeRequestOf,
  timingOf,
  validPhone,
  yesNo,
} from "./parse";

const TZ = "America/Los_Angeles";

describe("roleOf", () => {
  it("reads a founder even when the sentence says invest", () => {
    expect(roleOf("I am seek investment for my starups")).toBe("Raising");
    expect(roleOf("we need funding")).toBe("Raising");
    expect(roleOf("raising a seed round")).toBe("Raising");
  });
  it("reads an investor", () => {
    expect(roleOf("I write checks")).toBe("Investing");
    expect(roleOf("looking at deals")).toBe("Investing");
    expect(roleOf("family office")).toBe("Investing");
  });
  it("asks again when it can't tell", () => {
    expect(roleOf("hmm")).toBeNull();
    expect(roleOf("tell me more")).toBe("more");
  });
});

describe("amounts", () => {
  it("reads units and ranges", () => {
    expect(moneyIn("about 2M a year")).toBe(2e6);
    expect(moneyIn("$600k ARR")).toBe(600e3);
    expect(moneyIn("1 to 2 million")).toBe(2e6);
    expect(moneyIn("1,500,000")).toBe(1.5e6);
  });
  it("never guesses a bare number", () => {
    expect(moneyIn("1n")).toBeNull();
    expect(raiseOf("1n")).toBeNull();
    expect(bareNumber("1n")).toBe("1");
    expect(bareNumber("3M")).toBeNull();
  });
  it("buckets raise, stage and check", () => {
    expect(raiseOf("3 million")).toBe("$1M to $5M");
    expect(raiseOf("around 10M")).toBe("$5M to $20M");
    expect(raiseOf("500k")).toBe("Under $1M");
    expect(stageOf("we're pre revenue")).toBe("Pre revenue");
    expect(stageOf("about 2M a year")).toBe("$1M to $5M a year");
    expect(stageOf("we have revenue")).toBe("revenue");
    expect(checkOf("1 million")).toBe("$250K to $1M");
  });
});

describe("timing, industry, yes or no", () => {
  it("reads timing", () => {
    expect(timingOf("as soon as possible")).toBe("Within 30 days");
    expect(timingOf("a couple of months")).toBe("A few months");
    expect(timingOf("not sure")).toBe("Not sure yet");
  });
  it("maps industries onto /fit sector chips", () => {
    expect(industryOf("Solar")?.chips).toContain("Cleantech and Climate");
    expect(industryOf("an AI app")?.chips[0]).toBe("AI and Machine Learning");
    expect(industryOf("medical devices")?.chips[0]).toBe("Medical Devices");
    expect(industryOf("xyz")).toBeNull();
  });
  it("reads yes and no", () => {
    expect(yesNo("Sure")).toBe("yes");
    expect(yesNo("yes please")).toBe("yes");
    expect(yesNo("not now")).toBe("no");
    expect(yesNo("maybe")).toBeNull();
  });
});

describe("isSideTalk", () => {
  it("catches objections typed where an answer was expected", () => {
    expect(isSideTalk("Equity we don't pay upfront fee")).toBe(true);
    expect(isSideTalk("Is there upfront cost")).toBe(true);
    expect(isSideTalk("Are you a broker")).toBe(true);
    expect(isSideTalk("are you an AI")).toBe(true);
  });
  it("lets real answers through", () => {
    expect(isSideTalk("an AI app")).toBe(false);
    expect(isSideTalk("3 million")).toBe(false);
    expect(isSideTalk("solar")).toBe(false);
  });
});

describe("times", () => {
  // Thursday Oct 15 2026, 9:00 AM PT
  const now = new Date("2026-10-15T16:00:00Z");
  const slots = [
    { start: "2026-10-16T17:00:00Z", end: "2026-10-16T17:20:00Z" }, // Fri 10:00 AM PT
    { start: "2026-10-16T21:00:00Z", end: "2026-10-16T21:20:00Z" }, // Fri 2:00 PM PT
    { start: "2026-10-16T23:00:00Z", end: "2026-10-16T23:20:00Z" }, // Fri 4:00 PM PT
    { start: "2026-10-20T16:00:00Z", end: "2026-10-20T16:20:00Z" }, // Tue 9:00 AM PT
  ];
  it("parses a day and time", () => {
    expect(timeRequestOf("Friday 2pm pt")).toEqual({ weekday: 5, minutes: 840 });
    expect(timeRequestOf("Friday is best")).toEqual({ weekday: 5 });
    expect(timeRequestOf("3 million")).toBeNull();
  });
  it("books an exact match", () => {
    const r = slotsFor({ weekday: 5, minutes: 840 }, slots, TZ, now);
    expect(r).toEqual({ kind: "exact", slot: slots[1] });
  });
  it("offers times on the asked day", () => {
    const r = slotsFor({ weekday: 5 }, slots, TZ, now);
    expect(r.kind).toBe("options");
    if (r.kind === "options") expect(r.slots).toHaveLength(3);
  });
  it("offers the closest times when the hour is taken", () => {
    const r = slotsFor({ weekday: 5, minutes: 900 }, slots, TZ, now);
    expect(r.kind).toBe("options");
    if (r.kind === "options") expect(r.slots.map((s) => s.start)).toEqual([slots[1].start, slots[2].start]);
  });
  it("says the day is full and offers the next open times", () => {
    const r = slotsFor({ weekday: 3 }, slots, TZ, now);
    expect(r).toMatchObject({ kind: "options", full: true });
  });
  it("hears no to the offered times", () => {
    expect(declinesTimes("I can't do those days")).toBe(true);
    expect(declinesTimes("Tuesday")).toBe(false);
  });
});

describe("booking details", () => {
  it("builds the /fit match request", () => {
    const a = fitAnswersFor({ stage: "Pre revenue", raise: "$5M to $20M", industry: { label: "solar", chips: ["Cleantech and Climate"] } }, ["cleantech", "Software"]);
    expect(a).toEqual({ stage: ["pre_revenue"], raise: ["1m_10m", "over_10m"], industry: ["cleantech"], revenue: ["pre_revenue"], investorType: ["any"] });
    expect(fitAnswersFor({ stage: "Pre revenue" }, ["cleantech"])).toBeNull();
  });
  it("names the invite from the email", () => {
    expect(nameFromEmail("jane.doe@acme.com")).toBe("Jane Doe");
    expect(nameFromEmail("x1@acme.com")).toBe("Guest");
  });
  it("checks phone numbers", () => {
    expect(validPhone("+1 858 555 0100")).toBe(true);
    expect(validPhone("555")).toBe(false);
  });
});

describe("gap questions are side talk", () => {
  it("catches success rate, timeline and references mid question", () => {
    expect(isSideTalk("whats your success rate")).toBe(true);
    expect(isSideTalk("how long does it take to raise")).toBe(true);
    expect(isSideTalk("any case studies")).toBe(true);
    expect(isSideTalk("can I get references")).toBe(true);
  });
});
