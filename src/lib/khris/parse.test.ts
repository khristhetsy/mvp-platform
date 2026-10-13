import { describe, expect, it } from "vitest";
import { founderSignal, investorSignal, isKhrisSideTalk, khrisRoleOf, khrisStageOf, topicOf } from "./parse";

// Every case here comes from a real test conversation with the Khris chat (Oct 13, 2026).
describe("khrisRoleOf", () => {
  it("reads founders who say it their own way", () => {
    expect(khrisRoleOf("I am looking for angel investors can you help")).toBe("Raising");
    expect(khrisRoleOf("I am seeing funding")).toBe("Raising");
    expect(khrisRoleOf("Can you help me with funding")).toBe("Raising");
    expect(khrisRoleOf("I'm raising a seed round")).toBe("Raising");
  });
  it("still reads investors", () => {
    expect(khrisRoleOf("I write checks")).toBe("Investing");
    expect(khrisRoleOf("looking at deals")).toBe("Investing");
  });
  it("treats a question, typos included, as tell me more", () => {
    expect(khrisRoleOf("Hiw does your furn work")).toBe("more");
    expect(khrisRoleOf("What do you guys do")).toBe("more");
  });
});

describe("signals", () => {
  it("catches a visitor correcting the chat", () => {
    expect(founderSignal("I am not, I am seeking investors")).toBe(true);
    expect(founderSignal("I don't write check, I am seeking capital as I have already mentioned")).toBe(true);
    expect(founderSignal("Again I m seeking capital")).toBe(true);
    expect(investorSignal("I invest in seed rounds")).toBe(true);
    expect(investorSignal("I am seeking investors")).toBe(false);
  });
});

describe("khrisStageOf", () => {
  it("reads no revenue yet as pre revenue", () => {
    expect(khrisStageOf("No sales")).toBe("Pre revenue");
    expect(khrisStageOf("I mean we do have revenue yet")).toBe("Pre revenue");
    expect(khrisStageOf("pre revenue")).toBe("Pre revenue");
  });
  it("keeps Jessica 2.0's reading otherwise", () => {
    expect(khrisStageOf("about 2M a year")).toBe("$1M to $5M a year");
    expect(khrisStageOf("we have customers")).toBe("revenue");
  });
});

describe("topicOf", () => {
  it("routes each question to its written answer", () => {
    expect(topicOf("How to you get paud")).toBe("makeMoney");
    expect(topicOf("How do you make money, we are not interested to paid upfront fee")).toBe("makeMoney");
    expect(topicOf("We don't pay upfront fee")).toBe("upfront");
    expect(topicOf("Are you license")).toBe("license");
    expect(topicOf("Are you a broker dealer")).toBe("broker");
    expect(topicOf("Do you guys invest, do you have your own fud")).toBe("fund");
    expect(topicOf("What is your success rate")).toBe("successRate");
    expect(topicOf("How many investors do you have")).toBe("investorsCount");
    expect(topicOf("what is a qualifing process")).toBe("process");
    expect(topicOf("Do you make commission")).toBe("commission");
    expect(topicOf("What's your fee")).toBe("cost");
    expect(topicOf("Sorry I am not interested")).toBe("notInterested");
    expect(topicOf("Not a fit")).toBe("notFit");
    expect(topicOf("Are you a bot")).toBe("ai");
    expect(topicOf("What do you do for the company")).toBe("what");
    expect(topicOf("How does it work")).toBe("how");
  });
  it("answers refund, references and timeline questions", () => {
    expect(topicOf("Is there a refund if we don't raise?")).toBe("refund");
    expect(topicOf("Can I talk to founders you've worked with?")).toBe("references");
    expect(topicOf("Do you have references")).toBe("references");
    expect(topicOf("How long does it take to raise?")).toBe("timeline");
    expect(topicOf("How long have you been doing this")).toBe("years");
    expect(topicOf("How does the process work?")).toBe("how");
    expect(topicOf("How do you qualify companies?")).toBe("process");
    expect(topicOf("What kind of investors?")).toBe("investorTypes");
    expect(topicOf("Do you work with pre revenue companies?")).toBe("stageFit");
    expect(topicOf("pre revenue")).toBeNull();
    expect(topicOf("Can I talk to your previous clients")).toBe("references");
    expect(topicOf("I am not interested if paying a fee, can we work out something in the backed")).toBe("backend");
    expect(topicOf("Can you me me your contact")).toBe("contact");
    expect(topicOf("Do provide valuation")).toBe("valuation");
  });
  it("leaves plain answers alone", () => {
    expect(topicOf("Saas")).toBeNull();
    expect(topicOf("about 2M")).toBeNull();
  });
});

describe("isKhrisSideTalk", () => {
  it("treats Khris's common questions as side talk", () => {
    expect(isKhrisSideTalk("How to you get paud")).toBe(true);
    expect(isKhrisSideTalk("Are you license")).toBe(true);
    expect(isKhrisSideTalk("What is your success rate")).toBe(true);
  });
  it("does not treat answers as side talk", () => {
    expect(isKhrisSideTalk("Saas")).toBe(false);
    expect(isKhrisSideTalk("No sales")).toBe(false);
    expect(isKhrisSideTalk("in a few months")).toBe(false);
  });
});
