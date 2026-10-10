import { describe, it, expect } from "vitest";
import { JESSICA_OBJECTIONS } from "./config";
import { aiMode, bookingAnswers, looksLikeName, pickWording, questionKey, formatSlotWhen, groupSlotsByDay, matchReply, normalizeRole, parseAiReply, timeOfferLine, validEmail } from "./flow";

const PT = "America/Los_Angeles";

describe("groupSlotsByDay", () => {
  const slots = [
    { start: "2026-10-13T15:00:00.000Z", end: "2026-10-13T15:30:00.000Z" },
    { start: "2026-10-12T15:30:00.000Z", end: "2026-10-12T16:00:00.000Z" },
    { start: "2026-10-12T15:00:00.000Z", end: "2026-10-12T15:30:00.000Z" },
  ];

  it("groups by day in the display zone, earliest first", () => {
    const days = groupSlotsByDay(slots, PT);
    expect(days.map((d) => d.label)).toEqual(["Mon, Oct 12", "Tue, Oct 13"]);
    expect(days[0].slots.map((s) => s.label)).toEqual(["8:00 AM", "8:30 AM"]);
  });

  it("keeps only the first maxDays days", () => {
    expect(groupSlotsByDay(slots, PT, 1)).toHaveLength(1);
  });

  it("puts a late evening UTC slot on the previous day in Pacific time", () => {
    const days = groupSlotsByDay([{ start: "2026-10-13T02:00:00.000Z", end: "2026-10-13T02:30:00.000Z" }], PT);
    expect(days[0].label).toBe("Mon, Oct 12");
    expect(days[0].slots[0].label).toBe("7:00 PM");
  });

  it("skips slots with an invalid start", () => {
    expect(groupSlotsByDay([{ start: "nope", end: "nope" }], PT)).toEqual([]);
  });
});

describe("formatSlotWhen", () => {
  it("writes the day, time and zone label", () => {
    expect(formatSlotWhen("2026-10-12T15:30:00.000Z", PT, "PT")).toBe("Monday, October 12 at 8:30 AM PT");
  });
});

describe("normalizeRole", () => {
  it("sends investors and deal lookers down the investing path", () => {
    expect(normalizeRole("Looking at deals")).toBe("Investing");
    expect(normalizeRole("Investing")).toBe("Investing");
  });
  it("treats everything else as raising", () => {
    expect(normalizeRole("Raising capital")).toBe("Raising");
  });
});

describe("validEmail", () => {
  it("accepts a normal address and rejects junk", () => {
    expect(validEmail("founder@startup.com")).toBe(true);
    expect(validEmail("founder@startup")).toBe(false);
    expect(validEmail("not an email")).toBe(false);
  });
});

describe("bookingAnswers", () => {
  it("lists only what the visitor answered", () => {
    expect(bookingAnswers({ role: "Raising", stage: "Pre revenue", raise: "$1M to $5M" })).toEqual([
      { label: "Raising or investing", value: "Raising" },
      { label: "Company stage", value: "Pre revenue" },
      { label: "Raise size", value: "$1M to $5M" },
    ]);
  });
  it("returns nothing for an empty profile", () => {
    expect(bookingAnswers({})).toEqual([]);
  });
});

describe("matchReply", () => {
  it("answers cost questions with the approved line", () => {
    const r = matchReply("how much do you charge?");
    expect(r.kind).toBe("cost");
    expect(r.lines).toContain("It depends on the type of capital, and how much work we have to do.");
  });
  it("a question about upfront cost gets the fee answer, a refusal gets the objection", () => {
    expect(matchReply("Do you have upfront cost").kind).toBe("cost");
    expect(matchReply("is there an upfront fee?").kind).toBe("cost");
    expect(matchReply("We don't pay upfront fee").kind).toBe("objection");
    expect(matchReply("do you make commission").kind).toBe("objection");
    expect(matchReply("do you make commission").lines.join(" ")).toMatch(/No commission/);
  });
  it("treats no upfront fees as an objection, not a plain cost question", () => {
    const r = matchReply("I don't want to pay upfront fees");
    expect(r.kind).toBe("objection");
    expect(r.kind === "objection" && Object.keys(r.choices ?? {})).toEqual(["The cost", "The investors", "Both"]);
  });
  it("answers a board stall with the specific next meeting", () => {
    expect(matchReply("I have to talk to my board first").kind).toBe("objection");
  });
  it("treats not now as an objection with a question back, not a push", () => {
    const r = matchReply("i dont want to schedule anything yet");
    expect(r.kind).toBe("objection");
    expect(r.kind === "objection" && r.id).toBe("not-now");
  });
  it("handles send me info and press for a number", () => {
    expect(matchReply("can you just send me some info").kind).toBe("objection");
    expect(matchReply("just give me a number").lines.join(" ")).toMatch(/would be a guess/);
  });
  it("ends every objection path with a bridge into the time offer, never a yes or no question", () => {
    for (const o of JESSICA_OBJECTIONS) {
      const bridges = o.choices ? Object.values(o.choices).map((c) => c.bridge) : [o.bridge ?? ""];
      for (const b of bridges) {
        expect(b.length).toBeGreaterThan(0);
        expect(b).not.toMatch(/want me to|would you like|shall i/i);
      }
    }
  });
  it("never quotes a price or promises funding in any reply", () => {
    const all = [...matchReply("do you charge a fee").lines];
    for (const q of ["no upfront fees", "talk to my board", "send me info", "give me a number", "no budget"]) {
      all.push(...matchReply(q).lines);
    }
    for (const o of JESSICA_OBJECTIONS) {
      if (o.bridge) all.push(o.bridge);
      for (const v of o.variants ?? []) all.push(...v);
      for (const v of Object.values(o.choices ?? {})) all.push(...v.lines, v.bridge);
    }
    expect(all.join(" ")).not.toMatch(/\$\d|\d+\s?%|guarantee|contingent|if we (don'?t|cannot)/i);
  });
  it("says she is an AI assistant for Jessica only when asked directly", () => {
    expect(matchReply("are you a bot?").lines[0]).toBe("I'm an AI assistant for Jessica, and there's nothing here I can't help you with.");
    expect(matchReply("are you a bot?").lines[1]).toMatch(/someone from our team/);
    expect(matchReply("what is your name").kind).not.toBe("ai");
  });
  it("admits being an AI when asked", () => {
    expect(matchReply("are you a bot?").kind).toBe("ai");
    expect(matchReply("Am I talking to a real person?").kind).toBe("ai");
  });
  it("answers SPV questions from the fact sheet", () => {
    expect(matchReply("do you do SPV deals").kind).toBe("fact");
  });
  it("falls back for anything it has no answer for", () => {
    expect(matchReply("what is the weather like").kind).toBe("unknown");
  });
});

describe("aiMode", () => {
  it("closes first, qualifies after an ignored offer, and stops once booked", () => {
    expect(aiMode({ booked: false, offered: 0, sinceNew: 0 })).toBe("CLOSE");
    expect(aiMode({ booked: false, offered: 1, sinceNew: 0 })).toBe("QUALIFY");
    expect(aiMode({ booked: false, offered: 1, sinceNew: 2 })).toBe("CLOSE");
    expect(aiMode({ booked: true, offered: 3, sinceNew: 0 })).toBe("DONE");
  });
});

describe("timeOfferLine", () => {
  it("names the first two open days and changes wording on each offer", () => {
    const days = ["Tue, Oct 13", "Wed, Oct 14", "Thu, Oct 15"];
    const first = timeOfferLine(days, 0, "PT");
    const second = timeOfferLine(days, 1, "PT");
    expect(first).toContain("Tue, Oct 13");
    expect(first).toContain("Wed, Oct 14");
    expect(first).not.toContain("Thu");
    expect(second).not.toBe(first);
    const five = [0, 1, 2, 3, 4].map((n) => timeOfferLine(days, n, "PT"));
    expect(new Set(five).size).toBe(5);
    expect(timeOfferLine(days, 5, "PT")).toBe(five[0]);
  });
  it("copes with one or no days", () => {
    expect(timeOfferLine(["Tue, Oct 13"], 0, "PT")).toContain("Tue, Oct 13");
    expect(timeOfferLine([], 0, "PT")).toMatch(/Which day/);
  });
});

describe("parseAiReply", () => {
  it("keeps at most two short lines and the bridge or question", () => {
    const r = parseAiReply({ lines: ["a", "b", "c"], bridge: " x ", question: "" });
    expect(r).toEqual({ lines: ["a", "b"], bridge: "x", question: "" });
  });
  it("rejects junk", () => {
    expect(parseAiReply(null)).toBeNull();
    expect(parseAiReply({ lines: [] })).toBeNull();
    expect(parseAiReply({ lines: [42] })).toBeNull();
  });
});

describe("pickWording", () => {
  it("uses the written lines first, then each variant, then gives up", () => {
    const lines = ["a"], variants = [["b"], ["c"]];
    expect(pickWording(lines, variants, 0)).toEqual(["a"]);
    expect(pickWording(lines, variants, 1)).toEqual(["b"]);
    expect(pickWording(lines, variants, 2)).toEqual(["c"]);
    expect(pickWording(lines, variants, 3)).toBeNull();
  });
  it("keeps the approved fee sentence in every cost wording", () => {
    const r = matchReply("do you charge a fee?");
    if (r.kind !== "cost") throw new Error("expected cost");
    for (const w of [r.lines, ...r.variants]) {
      expect(w.join(" ").toLowerCase()).toContain("it depends on the type of capital, and how much work we have to do.");
    }
  });
  it("every objection has at least two other wordings, all different", () => {
    for (const o of JESSICA_OBJECTIONS) {
      const all = [o.lines.join(" "), ...(o.variants ?? []).map((v) => v.join(" "))];
      expect(all.length).toBeGreaterThanOrEqual(3);
      expect(new Set(all).size).toBe(all.length);
    }
  });
});

describe("questionKey", () => {
  it("treats rewordings of the same question as one", () => {
    expect(questionKey("What do you do?")).toBe(questionKey("what do you guys do"));
    expect(questionKey("What is your company do")).not.toBe(questionKey("where are you based"));
  });
});

describe("looksLikeName", () => {
  it("accepts names and rejects questions typed into the name prompt", () => {
    expect(looksLikeName("Khris")).toBe(true);
    expect(looksLikeName("Khris Thetsy")).toBe(true);
    expect(looksLikeName("Can you send some info")).toBe(false);
    expect(looksLikeName("what do you do?")).toBe(false);
    expect(looksLikeName("no")).toBe(false);
  });
});
