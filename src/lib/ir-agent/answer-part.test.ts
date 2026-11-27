import { describe, expect, it } from "vitest";
import { statedPart } from "./answer-part";

describe("statedPart", () => {
  it("keeps the answer from a message that also asks", () => {
    expect(statedPart("Software. Pre revenue. How much do you charge?")).toBe("Software. Pre revenue.");
    expect(statedPart("Hi, I am a founder raising a seed round. What does iCFO do?")).toBe("Hi, I am a founder raising a seed round.");
  });
  it("has nothing to keep from a plain question", () => {
    expect(statedPart("Are you an AI or a real person?")).toBe("");
    expect(statedPart("How much do you charge?")).toBe("");
  });
  it("does not treat a greeting or thanks as an answer", () => {
    expect(statedPart("Hello. What do you do?")).toBe("");
    expect(statedPart("Hi there. What do you do?")).toBe("");
    expect(statedPart("Thank you. Where are you based?")).toBe("");
  });
});
