import { describe, expect, it } from "vitest";
import { introHandledSummary, introHandledTitle, introRequestedSummary } from "@/lib/matching/intro-request-log-copy";

describe("intro request log copy", () => {
  it("names the investor in the activity title", () => {
    expect(introHandledTitle("contacted", "Tarra Sharp")).toBe("Intro to Tarra Sharp marked contacted");
    expect(introHandledTitle("facilitated", "Tarra Sharp")).toBe("Intro to Tarra Sharp marked introduced");
    expect(introHandledTitle("dismissed", "Tarra Sharp")).toBe("Intro to Tarra Sharp declined");
  });

  it("names the company on the investor's contact timeline", () => {
    expect(introRequestedSummary("Acme Robotics")).toBe("Intro requested by Acme Robotics");
    expect(introHandledSummary("contacted", "Acme Robotics")).toBe("Contacted for intro to Acme Robotics");
    expect(introHandledSummary("facilitated", "Acme Robotics")).toBe("Introduced to Acme Robotics");
    expect(introHandledSummary("declined", "Acme Robotics")).toBe("Intro to Acme Robotics declined");
  });

  it("never uses a dash as punctuation", () => {
    const all = [
      introHandledTitle("reviewing", "X"),
      introHandledSummary("reviewing", "Y"),
      introHandledSummary("new", "Y"),
      introRequestedSummary("Y"),
    ].join(" ");
    expect(all).not.toMatch(/ [-–—] /);
  });
});
