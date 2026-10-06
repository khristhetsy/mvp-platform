import { describe, expect, it } from "vitest";
import { isBlockedHost, mentionsPerson, parseBio, pickBioPages } from "./linkedin-bio";

describe("pickBioPages", () => {
  it("puts the firm's own pages first and drops blocked sites", () => {
    const urls = [
      "https://www.linkedin.com/in/dana",
      "https://events.example.org/speakers/dana",
      "https://www.harborpeak.vc/team/dana",
      "https://rocketreach.co/dana",
      "https://harborpeak.vc/deck.pdf",
    ];
    expect(pickBioPages(urls, "harborpeak.vc")).toEqual(["https://www.harborpeak.vc/team/dana", "https://events.example.org/speakers/dana"]);
  });
  it("works without a known firm domain", () => {
    expect(pickBioPages(["https://a.example.com/x", "https://zoominfo.com/p"], null)).toEqual(["https://a.example.com/x"]);
  });
  it("blocks subdomains of blocked hosts", () => {
    expect(isBlockedHost("fr.linkedin.com")).toBe(true);
    expect(isBlockedHost("harborpeak.vc")).toBe(false);
  });
});

describe("mentionsPerson", () => {
  it("needs both names on the page", () => {
    expect(mentionsPerson("Dana Whitfield is a Partner", "Dana", "Whitfield")).toBe(true);
    expect(mentionsPerson("Whitfield Capital", "Dana", "Whitfield")).toBe(false);
    expect(mentionsPerson("anything", "Dana", "")).toBe(false);
  });
});

describe("parseBio", () => {
  it("reads a bio and removes dash punctuation", () => {
    expect(parseBio('{"bio":"Dana is a Partner at Harbor Peak Ventures — she leads seed investments in software."}')).toBe(
      "Dana is a Partner at Harbor Peak Ventures, she leads seed investments in software.",
    );
  });
  it("returns null for null, short or broken replies", () => {
    expect(parseBio('{"bio": null}')).toBeNull();
    expect(parseBio('{"bio":"Too short."}')).toBeNull();
    expect(parseBio("no json")).toBeNull();
  });
});
