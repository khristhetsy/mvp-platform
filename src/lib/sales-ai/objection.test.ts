import { describe, expect, it } from "vitest";
import { classifyObjection, CLOSING_QUESTION, TECHNIQUE } from "./objection";
import { OBJECTIONS } from "./types";

describe("classifyObjection", () => {
  it("treats cost raised with timing as a money objection", () => {
    expect(classifyObjection(["How long does this take and what is included?", "I would rather not pay before I know it works."])).toBe("money");
  });

  it("reads timing on its own", () => {
    expect(classifyObjection(["What is the timeline?"])).toBe("timing");
  });

  it("reads a team objection", () => {
    expect(classifyObjection(["I need to discuss this with my board first."])).toBe("team");
  });

  it("puts ready ahead of everything else", () => {
    expect(classifyObjection(["Sounds good, send me the link. What does it cost?"])).toBe("ready");
  });

  it("reads a value question", () => {
    expect(classifyObjection(["I'm not sure it works for hardware companies."])).toBe("value");
  });

  it("reads fence sitting", () => {
    expect(classifyObjection(["Let me think about it."])).toBe("fence");
  });

  it("is unknown when there is nothing to read", () => {
    expect(classifyObjection([])).toBe("unknown");
    expect(classifyObjection([null, undefined, "   "])).toBe("unknown");
    expect(classifyObjection(["Thanks."])).toBe("unknown");
  });

  it("has a technique and a closing question for every type", () => {
    for (const o of OBJECTIONS) {
      expect(TECHNIQUE[o].length).toBeGreaterThan(0);
      expect(CLOSING_QUESTION[o].endsWith("?")).toBe(true);
    }
  });
});
