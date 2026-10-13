import { describe, expect, it } from "vitest";
import { answersFor, isQuestion, matchJohnny, typoFix } from "./config";
import {
  OPTIONS,
  applyOption,
  applyOtherText,
  bareNumber,
  industriesIn,
  summaryLine,
  investorTypeValue,
  emptyProfile,
  extractAmounts,
  extractFields,
  formatRange,
  missingFields,
  parseJohnnyReply,
  profileAnswers,
  summaryLines,
} from "./profile";

describe("extractFields", () => {
  it("fills all five fields from one sentence", () => {
    const p = emptyProfile();
    const changed = extractFields(p, "I'm an angel, I write 50k to 100k checks in software and healthcare, seed stage, equity and debt", null);
    expect(p.type).toBe("Individual angel");
    expect([p.cmin, p.cmax]).toEqual([50_000, 100_000]);
    expect(p.sect).toEqual(["Software", "Healthcare"]);
    expect(p.stage).toEqual(["Seed"]);
    expect(p.cap).toEqual(["Equity", "Venture debt"]);
    expect(changed).toHaveLength(5);
    expect(missingFields(p)).toEqual([]);
  });
  it("reads a bare 'all' as the answer to the question just asked", () => {
    const p = emptyProfile();
    extractFields(p, "all", "sect");
    expect(p.sect).toEqual(["Other"]);
    extractFields(p, "all of the above", "cap");
    expect(p.cap).toEqual(["Equity", "SAFE", "Convertible note", "Venture debt", "Revenue-based"]);
  });
  it("does not read years or counts as a check size", () => {
    expect(extractAmounts("I have invested for 16 years in 40 companies")).toEqual([]);
    expect(extractAmounts("$1.5 million")).toEqual([1_500_000]);
    expect(extractAmounts("500k")).toEqual([500_000]);
  });
  it("reads free text industries onto the vocabulary list, like Jessica 2.0", () => {
    expect(industriesIn("mostly cybersecurity and robotics")).toEqual(["Cyber Security", "Robotics"]);
    expect(industriesIn("b2b saas")).toEqual(["SaaS / B2B Software"]);
    expect(industriesIn("climate and batteries")).toEqual(["Cleantech", "Energy"]);
    expect(industriesIn("medtech")).toEqual(["Medical Devices"]);
  });
  it("checks a bare number instead of guessing, and reads back in one line", () => {
    expect(bareNumber("2")).toBe("2");
    expect(bareNumber("$1.5")).toBe("1.5");
    expect(bareNumber("2m")).toBeNull();
    expect(bareNumber("2500")).toBeNull();
    const p = emptyProfile();
    applyOption(p, "type", "Family office");
    applyOption(p, "check", "$1M to $5M");
    applyOption(p, "sect", "Fintech");
    expect(summaryLine(p)).toBe("So: Family office, checks of $1M to $5M, Fintech.");
  });
  it("does not take cybersecurity for a securities question", () => {
    expect(matchJohnny("mostly cybersecurity")).toBeNull();
    expect(matchJohnny("do you sell securities?")?.kind).toBe("answer");
  });
  it("keeps a typed Other answer as given", () => {
    const p = emptyProfile();
    expect(applyOtherText(p, "sect", "space tech")).toBe(true);
    expect(p.sect).toEqual(["Space Tech"]);
    expect(applyOtherText(p, "sect", "what do you mean?")).toBe(false);
  });
  it("maps pre seed and seed separately", () => {
    const p = emptyProfile();
    extractFields(p, "pre-seed and seed", null);
    expect(p.stage).toEqual(["Pre-seed", "Seed"]);
  });
  it("keeps enterprise software from also adding software", () => {
    const p = emptyProfile();
    extractFields(p, "enterprise software", null);
    expect(p.sect).toEqual(["Enterprise Software"]);
  });
  it("uses the investor profile form's own lists", () => {
    expect(OPTIONS.type).toEqual(["Individual angel", "Angel group / syndicate", "Family office", "Venture fund", "Corporate / strategic", "Other"]);
    expect(OPTIONS.stage).toEqual(["Pre-seed", "Seed", "Series A", "Series B", "Growth", "Other"]);
    expect(OPTIONS.cap).toEqual(["Equity", "SAFE", "Convertible note", "Venture debt", "Revenue-based", "Other"]);
    expect(OPTIONS.sect[OPTIONS.sect.length - 1]).toBe("Other");
    const p = emptyProfile();
    extractFields(p, "we are a VC doing series b, SAFEs and convertible notes in fintech and AI", null);
    expect(p.type).toBe("Venture fund");
    expect(p.stage).toEqual(["Series B"]);
    expect(p.cap).toEqual(["SAFE", "Convertible note"]);
    expect(p.sect).toEqual(["Fintech", "AI / ML"]);
  });
});

describe("options and read back", () => {
  it("one tap answers, every unanswered field stays missing", () => {
    const p = emptyProfile();
    applyOption(p, "type", "Family office");
    applyOption(p, "check", "$250K to $1M");
    expect(p.type).toBe("Family office");
    expect(formatRange(p)).toBe("$250K to $1M");
    expect(missingFields(p)).toEqual(["sect", "stage", "cap"]);
    expect(Object.values(OPTIONS).flat()).not.toContain("Skip");
    expect(summaryLines(p)).toEqual(["Family office.", "Checks of $250K to $1M."]);
    expect(profileAnswers(p).map((a) => a.label)).toEqual(["Investor type", "investor_type value", "Check size"]);
    expect(investorTypeValue("Family office")).toBe("family_office");
  });
  it("formats the open ended buckets", () => {
    const p = emptyProfile();
    applyOption(p, "check", "Under $250K");
    expect(formatRange(p)).toBe("under $250K");
    applyOption(p, "check", "$25M or more");
    expect(formatRange(p)).toBe("$25M or more");
  });
});

describe("parseJohnnyReply guard", () => {
  const ok = { lines: ["Thank you."], fields: {}, ask: "none", ready: false };
  it("accepts a clean reply", () => {
    expect(parseJohnnyReply(ok, "", "")?.lines).toEqual(["Thank you."]);
  });
  it("refuses percentages, dashes, AI talk and invented dollar figures", () => {
    for (const line of ["Returns of 50% are common.", "We help - always.", "As an AI I cannot say.", "Our fee is $5,000 a month."]) {
      expect(parseJohnnyReply({ ...ok, lines: [line] }, "50k", "50k")).toBeNull();
    }
  });
  it("lets a dollar figure through only when the visitor said it", () => {
    expect(parseJohnnyReply({ ...ok, lines: ["Understood, $50k checks."] }, "50kto100k", "50k to 100k")).not.toBeNull();
    expect(parseJohnnyReply({ ...ok, lines: ["Understood, $75k checks."] }, "50kto100k", "50k to 100k")).toBeNull();
  });
  it("drops unknown field values", () => {
    const r = parseJohnnyReply({ ...ok, fields: { investor_type: "Wizard", preferred_stages: ["Seed", "Moon"], capital_types: ["Equity", "Gold"] } }, "", "");
    expect(r?.fields.type).toBeUndefined();
    expect(r?.fields.stage).toEqual(["Seed"]);
    expect(r?.fields.cap).toEqual(["Equity"]);
  });
});

describe("matchJohnny", () => {
  it("answers money questions with the approved wording", () => {
    const s = matchJohnny("how do you make money?");
    expect(s && s.kind === "answer" && s.wordings[0][0].join(" ")).toContain("Mostly free for investors");
    const c = matchJohnny("do you take commission?");
    expect(c && c.kind === "answer" && c.wordings[0][0][0]).toContain("No commission");
  });
  it("routes opt out, too many questions, the AI question and company count", () => {
    expect(matchJohnny("not interested, please remove me")?.kind).toBe("stop");
    expect(matchJohnny("not interested")?.kind).toBe("no");
    expect(matchJohnny("No")?.kind).toBe("no");
    expect(matchJohnny("I need to check with my partners")?.kind).toBe("stall");
    expect(matchJohnny("too many questions")?.kind).toBe("toomany");
    expect(matchJohnny("are you a bot?")?.kind).toBe("ai");
    const n = matchJohnny("how many companies do you work with?");
    expect(n && n.kind === "answer" && n.ids).toEqual(["count"]);
  });
  it("leaves ordinary profile answers alone", () => {
    expect(matchJohnny("I invest 500k checks")).toBeNull();
    expect(matchJohnny("software and healthcare")).toBeNull();
  });
});

describe("test conversation fixes (Oct 13)", () => {
  it("answers licensing like the broker question, and the questions investors asked", () => {
    const lic = matchJohnny("Are license");
    expect(lic && lic.kind === "answer" && lic.ids).toEqual(["securities"]);
    for (const [q, id] of [["What does your company do", "what"], ["How do you qualify company", "qualify"], ["Do you provide due diligence", "diligence"]] as const) {
      const m = matchJohnny(q);
      expect(m && m.kind === "answer" && m.ids).toEqual([id]);
    }
    expect(matchJohnny("What kind of deal suze")?.kind).toBe("dealsize");
    const c = matchJohnny("How many deal flow do you work with per year");
    expect(c && c.kind === "answer" && c.ids).toEqual(["count"]);
  });
  it("tells a question from an answer", () => {
    expect(isQuestion("Are license")).toBe(true);
    expect(isQuestion("What does your company do")).toBe(true);
    expect(isQuestion("Seed")).toBe(false);
    expect(isQuestion("250k")).toBe(false);
  });
  it("reads a one word typo fix as the earlier question", () => {
    const earlier = ["Fintech", "What kind of deal suze"];
    expect(typoFix("Suze", earlier)?.original).toBe("What kind of deal suze");
    expect(typoFix("Size", [...earlier, "Suze"])?.text).toBe("What kind of deal size");
    expect(typoFix("Seed", ["Do you do due diligence?"])).toBeNull();
    expect(typoFix("250k", earlier)).toBeNull();
  });
  it("says checks under, not checks of under", () => {
    const p = emptyProfile();
    applyOption(p, "check", "Under $250K");
    expect(summaryLine(p)).toBe("So: checks under $250K.");
  });
});

describe("investor questions and the no ladder (Oct 13)", () => {
  const ids = (q: string) => answersFor(q).map((a) => a.id);
  it("answers the top investor questions", () => {
    const cases: Array<[string, string[]]> = [
      ["Are you a fund?", ["fund"]],
      ["I mean do you invest", ["fund"]],
      ["Are you a service provider", ["service"]],
      ["How to you guys get paid", ["money"]],
      ["Who pays you, the company or me?", ["whopays"]],
      ["Who are your clients?", ["clients"]],
      ["Who is on the team?", ["team"]],
      ["Do you have a stake in the companies?", ["stake"]],
      ["Can I see a deal now?", ["seedeal"]],
      ["What sectors do you cover?", ["coverage"]],
      ["What is your track record?", ["track"]],
      ["What happens after the call?", ["after"]],
      ["Is my information kept private?", ["privacy"]],
      ["Do you have deals with revenue", ["dealflow"]],
      ["Cand send me so info about your company", ["info"]],
      ["What do you guys do", ["what"]],
    ];
    for (const [q, want] of cases) expect(ids(q), q).toEqual(want);
  });
  it("answers both parts of a two part question, in order", () => {
    expect(ids("How many deals do you work with and how do to you qualify deals")).toEqual(["count", "qualify"]);
  });
  it("never reads a question as a field value, and never overwrites an answer", () => {
    expect(isQuestion("Do have a fund")).toBe(true);
    expect(ids("Do have a fund")).toEqual(["fund"]);
    const p = emptyProfile();
    applyOption(p, "type", "Individual angel");
    extractFields(p, "we also run a small fund", "check");
    expect(p.type).toBe("Individual angel");
    extractFields(p, "actually we're a venture fund", "check");
    expect(p.type).toBe("Venture fund");
  });
  it("does not store a request as an Other answer", () => {
    const p = emptyProfile();
    expect(applyOtherText(p, "sect", "Cand send me so info about your company")).toBe(false);
    expect(p.sect).toEqual([]);
  });
  it("does not read robotics as a bot question", () => {
    expect(isQuestion("mostly cybersecurity and robotics")).toBe(false);
  });
  it("keeps the thesis and follow up permission on the invite", () => {
    const p = emptyProfile();
    p.thesis = "Seed SaaS with real revenue";
    p.followUp = true;
    expect(profileAnswers(p).map((a) => a.label)).toEqual(["Investment thesis", "Follow up"]);
  });
});

describe("live test fixes (Oct 13, afternoon)", () => {
  it("reads the typo 'how deals do you work with' as the deal count question", () => {
    expect(answersFor("how deals do you work with").map((a) => a.id)).toEqual(["count"]);
  });
  it("mentions due diligence and prequalification when asked how companies are qualified", () => {
    const q = answersFor("how do you qualify company")[0];
    expect(q.wordings[0].join(" ")).toContain("due diligence");
    expect(answersFor("do you prequalify companies?")[0].id).toBe("diligence");
  });
});
