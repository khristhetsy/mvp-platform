import { describe, it, expect } from "vitest";
import {
  DANIELA_AI_LINES,
  DANIELA_CHECK_OPTIONS,
  DANIELA_COST_LINES,
  DANIELA_OBJECTIONS,
  DANIELA_RAISE_OPTIONS,
  DANIELA_ROLE_OPTIONS,
  DANIELA_STAGE_OPTIONS,
  DANIELA_SYSTEM_PROMPT,
  DANIELA_TIMING_OPTIONS,
} from "./config";
import { bookingAnswers, industryOf, matchReply, missingProfileStep, normalizeRole, optionFor } from "./flow";

function handler(text: string): string {
  const r = matchReply(text);
  return r.kind === "objection" || r.kind === "fact" ? `${r.kind}:${r.id}` : r.kind;
}

describe("matchReply, the phrases from the live Michael chat", () => {
  it.each([
    ["are you guys license", "objection:licensing"],
    ["do you make commission", "objection:commission"],
    ["is there a fee", "cost"],
    ["I dont pay upfront fee", "objection:upfront-fee"],
    ["i dont think its a fit", "objection:fit"],
    ["are you a AI?", "ai"],
    ["how do you get paid", "objection:get-paid"],
    ["Do does your company do", "fact:what"],
    ["what does it cost", "cost"],
    ["how does it work", "fact:process"],
    ["who are the investors", "objection:investors"],
    ["what is the weather like", "unknown"],
  ])("%s -> %s", (text, expected) => {
    expect(handler(text)).toBe(expected);
  });

  it("does not read a fit question or a fit statement as an objection", () => {
    expect(handler("is this a good fit for a biotech company")).not.toBe("objection:fit");
    expect(handler("we are a great fit")).not.toBe("objection:fit");
  });

  it("does not mistake 'how do you get paid' for a process question", () => {
    expect(handler("how do you get paid")).not.toBe("fact:process");
    expect(handler("how do you work")).toBe("fact:process");
  });
});

describe("approved wording", () => {
  it("keeps the approved fee sentence in the cost answer", () => {
    expect(DANIELA_COST_LINES[0]).toBe("It depends on the type of capital, and how much work we have to do.");
  });

  it("says she is an AI assistant for Daniela only when asked directly", () => {
    expect(matchReply("are you a bot?").lines[0]).toBe("I'm an AI assistant for Daniela, and there's nothing here I can't help you with.");
    expect(DANIELA_AI_LINES[1]).toMatch(/someone from our team/);
    expect(matchReply("what is your name").kind).not.toBe("ai");
  });

  it("answers licensing without claiming a license", () => {
    const text = matchReply("are you licensed").lines.join(" ");
    expect(text).toMatch(/not a broker dealer/);
    expect(text).toMatch(/don't sell securities/);
    expect(text).not.toMatch(/we are (fully )?(licensed|registered)/i);
  });

  it("never ties a fee to money raised", () => {
    const text = matchReply("how do you get paid").lines.join(" ");
    expect(text).toMatch(/not for money you raise/);
  });

  it("every objection has at least two other wordings, all different", () => {
    for (const o of DANIELA_OBJECTIONS) {
      const all = [o.lines.join(" "), ...(o.variants ?? []).map((v) => v.join(" "))];
      expect(all.length, o.id).toBeGreaterThanOrEqual(3);
      expect(new Set(all).size, o.id).toBe(all.length);
    }
  });

  it("ends every objection path with a bridge into the time offer, never a yes or no question", () => {
    for (const o of DANIELA_OBJECTIONS) {
      const bridges = o.choices ? Object.values(o.choices).map((c) => c.bridge) : [o.bridge ?? ""];
      for (const b of bridges) {
        expect(b.length, o.id).toBeGreaterThan(0);
        expect(b, o.id).not.toMatch(/want me to|would you like|shall i/i);
      }
    }
  });

  it("never quotes a price, a percentage or a promise in any scripted reply", () => {
    const all: string[] = [...DANIELA_COST_LINES];
    for (const o of DANIELA_OBJECTIONS) {
      all.push(...o.lines);
      if (o.bridge) all.push(o.bridge);
      if (o.repeatBridge) all.push(o.repeatBridge);
      for (const v of o.variants ?? []) all.push(...v);
      for (const c of Object.values(o.choices ?? {})) all.push(...c.lines, c.bridge);
    }
    expect(all.join(" ")).not.toMatch(/\$\d|\d+\s?%|guarantee|contingent|if we (don'?t|cannot)/i);
  });

  it("uses no dashes as sentence punctuation in the copy", () => {
    const all = [
      ...DANIELA_COST_LINES,
      ...DANIELA_OBJECTIONS.flatMap((o) => [...o.lines, ...(o.variants ?? []).flat(), ...Object.values(o.choices ?? {}).flatMap((c) => [...c.lines, c.bridge])]),
    ];
    for (const line of all) expect(line).not.toMatch(/ [-–—] |—|–/);
  });
});

describe("system prompt", () => {
  it("carries Daniela's identity, the AI line, the licensing rule and no prices", () => {
    expect(DANIELA_SYSTEM_PROMPT).toMatch(/You are Daniela/);
    expect(DANIELA_SYSTEM_PROMPT).toMatch(/Executive Vice President/);
    expect(DANIELA_SYSTEM_PROMPT).toContain("I'm an AI assistant for Daniela, and there's nothing here I can't help you with.");
    expect(DANIELA_SYSTEM_PROMPT).toMatch(/Never claim any license or registration/);
    expect(DANIELA_SYSTEM_PROMPT).not.toMatch(/Jessica/);
  });
});

describe("normalizeRole", () => {
  it("sends investors down the investing path and everyone else down raising", () => {
    expect(normalizeRole("Exploring investments")).toBe("Investing");
    expect(normalizeRole("Investing")).toBe("Investing");
    expect(normalizeRole("Raising capital")).toBe("Raising");
  });
});

describe("missingProfileStep", () => {
  it("walks the founder profile in order: stage, industry, raise, timing", () => {
    expect(missingProfileStep({})).toBe("role");
    expect(missingProfileStep({ role: "Raising" })).toBe("stage");
    expect(missingProfileStep({ role: "Raising", stage: "Pre revenue" })).toBe("industry");
    expect(missingProfileStep({ role: "Raising", stage: "Pre revenue", industry: "solar" })).toBe("raise");
    expect(missingProfileStep({ role: "Raising", stage: "Pre revenue", industry: "solar", raise: "$1M to $5M" })).toBe("timing");
    expect(missingProfileStep({ role: "Raising", stage: "Pre revenue", industry: "solar", raise: "$1M to $5M", timing: "Within 30 days" })).toBeNull();
  });
  it("asks investors only for a check size", () => {
    expect(missingProfileStep({ role: "Investing" })).toBe("check");
    expect(missingProfileStep({ role: "Investing", checkSize: "$1M to $5M" })).toBeNull();
  });
});

describe("bookingAnswers", () => {
  it("saves the founder profile in order, industry included, and leaves out what is missing", () => {
    expect(
      bookingAnswers({ role: "Raising", stage: "Pre revenue", industry: "solar", raise: "$1M to $5M", timing: "Within 30 days" }),
    ).toEqual([
      { label: "Raising or investing", value: "Raising" },
      { label: "Company stage", value: "Pre revenue" },
      { label: "Industry", value: "solar" },
      { label: "Raise size", value: "$1M to $5M" },
      { label: "Time to close", value: "Within 30 days" },
    ]);
    expect(bookingAnswers({})).toEqual([]);
  });
});

describe("optionFor, typed answers read as chips", () => {
  it("reads stage, raise, timing, check and role from a sentence", () => {
    expect(optionFor("stage", "we make about 3m a year", DANIELA_STAGE_OPTIONS)).toBe("$1M to $5M");
    expect(optionFor("stage", "pre revenue", DANIELA_STAGE_OPTIONS)).toBe("Pre revenue");
    expect(optionFor("stage", "800k in sales", DANIELA_STAGE_OPTIONS)).toBe("Under $1M a year");
    expect(optionFor("raise", "looking for 2 million", DANIELA_RAISE_OPTIONS)).toBe("$1M to $5M");
    expect(optionFor("raise", "$25M", DANIELA_RAISE_OPTIONS)).toBe("Over $20M");
    expect(optionFor("timing", "in a few months", DANIELA_TIMING_OPTIONS)).toBe("In the next few months");
    expect(optionFor("timing", "asap", DANIELA_TIMING_OPTIONS)).toBe("Within 30 days");
    expect(optionFor("timing", "not sure", DANIELA_TIMING_OPTIONS)).toBe("Still deciding");
    expect(optionFor("check", "around 500k", DANIELA_CHECK_OPTIONS)).toBe("$250K to $1M");
    expect(optionFor("role", "we are a startup raising money", DANIELA_ROLE_OPTIONS)).toBe("Raising capital");
    expect(optionFor("role", "I am an investor", DANIELA_ROLE_OPTIONS)).toBe("Exploring investments");
  });
  it("leaves questions, objections and unclear text to the normal reply", () => {
    expect(optionFor("raise", "how much does it cost?", DANIELA_RAISE_OPTIONS)).toBeNull();
    expect(optionFor("stage", "is there a fee", DANIELA_STAGE_OPTIONS)).toBeNull();
    expect(optionFor("stage", "we sell things", DANIELA_STAGE_OPTIONS)).toBeNull();
    expect(optionFor("raise", "not sure yet", DANIELA_RAISE_OPTIONS)).toBeNull();
  });
});

describe("industryOf", () => {
  it("maps what a founder types to a plain label", () => {
    expect(industryOf("solar panels")?.label).toBeTruthy();
    expect(industryOf("blue sky thinking")).toBeNull();
  });
});
