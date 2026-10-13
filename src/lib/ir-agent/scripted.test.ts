import { describe, expect, it } from "vitest";
import { fill, matchAgent, taughtAnswerFor } from "./scripted";

const taught = [
  { id: "1", question: "How much are you raising?", answer: "The team covers the round on the call." },
  { id: "2", question: "Where is the company based?", answer: "We are based in Austin, Texas." },
  { id: "3", question: "Who is on the founding team?", answer: "Two cofounders with ten years in logistics." },
];

describe("matchAgent", () => {
  it("hard stops on remove me and unsubscribe", () => {
    expect(matchAgent("please remove me", taught)).toEqual({ kind: "stop" });
    expect(matchAgent("Unsubscribe", taught)).toEqual({ kind: "stop" });
    expect(matchAgent("stop contacting me", taught)).toEqual({ kind: "stop" });
  });
  it("starts the no ladder on a plain no", () => {
    expect(matchAgent("no", taught)).toEqual({ kind: "no" });
    expect(matchAgent("Not interested", taught)).toEqual({ kind: "no" });
  });
  it("spots the AI question", () => {
    expect(matchAgent("are you a bot?", taught)).toEqual({ kind: "ai" });
  });
  it("answers from what the founder taught, only for questions", () => {
    expect(matchAgent("Where are you guys based?", taught)).toEqual({ kind: "taught", answer: "We are based in Austin, Texas." });
    expect(matchAgent("who's on your founding team", taught)).toEqual({ kind: "taught", answer: taught[2].answer });
    expect(matchAgent("Austin", taught)).toBeNull();
  });
  it("leaves ordinary answers alone", () => {
    expect(matchAgent("I write checks of 250k in fintech", taught)).toBeNull();
  });
});

describe("taughtAnswerFor", () => {
  it("needs real overlap", () => {
    expect(taughtAnswerFor("What is your favorite color?", taught)).toBeNull();
  });
  it("picks the best match", () => {
    expect(taughtAnswerFor("how much is the company raising", taught)?.id).toBe("1");
  });
});

describe("fill", () => {
  it("replaces company and name", () => {
    expect(fill("{{name}} at {{company}}", { company: "Northwind", name: "Ava" })).toBe("Ava at Northwind");
  });
});
