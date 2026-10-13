import { describe, expect, it } from "vitest";
import { firstName, looksLikeName, topicOf } from "./topics";

// Cases come from a real test conversation with the Michael mockup (Oct 13, 2026).
describe("topicOf", () => {
  it("reads the questions that fell through before", () => {
    expect(topicOf("are you guys license")).toBe("license");
    expect(topicOf("Are you licensed?")).toBe("license");
    expect(topicOf("i dont think its a fit")).toBe("fit");
    expect(topicOf("this is not a fit for us")).toBe("fit");
    expect(topicOf("how do you get paid")).toBe("fee");
    expect(topicOf("how do you get paud")).toBe("fee");
    expect(topicOf("Do does your company do")).toBe("what");
    expect(topicOf("what does your company do")).toBe("what");
  });

  it("keeps the fee answers that already worked", () => {
    expect(topicOf("do you make commission")).toBe("commission");
    expect(topicOf("is there a fee")).toBe("fee");
    expect(topicOf("I dont pay upfront fee")).toBe("upfront");
    expect(topicOf("how much does it cost")).toBe("fee");
  });

  it("reads the bot question, and only that", () => {
    expect(topicOf("are you a AI?")).toBe("ai");
    expect(topicOf("is this a bot")).toBe("ai");
    expect(topicOf("am I talking to a real person")).toBe("ai");
    expect(topicOf("I run an AI startup and need capital")).toBeNull();
  });

  it("reads questions about Michael and the firm", () => {
    expect(topicOf("who is michael")).toBe("background");
    expect(topicOf("tell me about your background")).toBe("background");
    expect(topicOf("what services do you offer")).toBe("services");
    expect(topicOf("is icfo legit?")).toBe("legit");
    expect(topicOf("are you a broker dealer")).toBe("license");
  });

  it("does not read ordinary words as topics", () => {
    expect(topicOf("we are happy with our product")).toBeNull();
    expect(topicOf("I feel good about the numbers")).toBeNull();
  });
});

describe("looksLikeName", () => {
  it("takes names and rejects questions", () => {
    expect(looksLikeName("Anna")).toBe(true);
    expect(looksLikeName("I'm Anna")).toBe(true);
    expect(looksLikeName("Anna Lee")).toBe(true);
    expect(looksLikeName("Can you send some info")).toBe(false);
    expect(looksLikeName("what is the fee?")).toBe(false);
  });
  it("pulls the first name", () => {
    expect(firstName("my name is anna lee")).toBe("Anna");
    expect(firstName("I'm Sam")).toBe("Sam");
  });
});
