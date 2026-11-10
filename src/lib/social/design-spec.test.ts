import { describe, it, expect } from "vitest";
import { parseSpec, buildSpecSystem } from "./design-spec";

const request = "Banner for the fit quiz. 9 of 11 pitches missed the fit. Button: Take the fit quiz.";

describe("parseSpec", () => {
  it("reads JSON wrapped in prose or code fences", () => {
    const spec = parseSpec('Here:\n```json\n{"headline":"Match the right investors","button":"Take the fit quiz"}\n```', request);
    expect(spec).toEqual({ headline: "Match the right investors", button: "Take the fit quiz" });
  });
  it("keeps a stat only when its number is in the request", () => {
    expect(parseSpec('{"headline":"H","stat":{"value":"9","label":"missed the fit"}}', request)?.stat).toEqual({ value: "9", label: "missed the fit" });
    expect(parseSpec('{"headline":"H","stat":{"value":"72%","label":"made up"}}', request)?.stat).toBeUndefined();
  });
  it("rejects bad replies", () => {
    expect(parseSpec("Sorry, I cannot do that.", request)).toBeNull();
    expect(parseSpec("{not json}", request)).toBeNull();
    expect(parseSpec('{"subline":"no headline"}', request)).toBeNull();
    expect(parseSpec(`{"headline":"${"x".repeat(71)}"}`, request)).toBeNull();
  });
});

describe("buildSpecSystem", () => {
  it("forbids invented facts", () => {
    expect(buildSpecSystem("brand", 0)).toMatch(/Never invent/);
  });
});
