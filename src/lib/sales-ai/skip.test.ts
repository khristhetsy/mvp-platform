import { describe, expect, it } from "vitest";
import { cleanList, detectSkip, phraseRegex } from "./skip";

const rules = { skipPhrases: ["convertible note", "bridge", "SPV"], skipTags: ["Deal"] };

describe("detectSkip", () => {
  it("matches deal wording in the thread, ignoring case", () => {
    const hit = detectSkip({ title: "Offer Attia", tags: [], texts: ["Need terms for $5m Convertible Note, a bridge"] }, rules);
    expect(hit?.matched).toEqual(['"convertible note"', '"bridge"']);
  });

  it("matches whole words only", () => {
    expect(detectSkip({ title: "Abridged plan", tags: [], texts: ["an overbridged spvx"] }, rules)).toBeNull();
  });

  it("matches a tag ignoring case", () => {
    const hit = detectSkip({ title: "Maria", tags: ["deal"], texts: [] }, rules);
    expect(hit?.matched).toEqual(["tag Deal"]);
  });

  it("returns null for an ordinary subscription conversation", () => {
    expect(detectSkip({ title: "Maria Lopez", tags: ["Founder"], texts: ["We cannot take on another monthly cost"] }, rules)).toBeNull();
  });

  it("returns null when there are no rules", () => {
    expect(detectSkip({ title: "x", tags: ["Deal"], texts: ["bridge"] }, { skipPhrases: [], skipTags: [] })).toBeNull();
  });

  it("treats regex characters in a phrase as plain text", () => {
    expect(phraseRegex("a+b")?.test("see a+b here")).toBe(true);
    expect(phraseRegex("a+b")?.test("see aab here")).toBe(false);
  });
});

describe("cleanList", () => {
  it("trims, drops blanks and repeats, and caps the length", () => {
    expect(cleanList([" bridge ", "Bridge", "", "x", "SPV", 5, "term  sheet"], 3)).toEqual(["bridge", "SPV", "term sheet"]);
  });
  it("returns an empty list for anything that is not a list", () => {
    expect(cleanList("bridge", 5)).toEqual([]);
  });
});
