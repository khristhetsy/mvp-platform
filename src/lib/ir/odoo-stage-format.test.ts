import { describe, expect, it } from "vitest";
import { durationLabel, splitSteps } from "@/lib/ir/odoo-stage-format";

describe("durationLabel", () => {
  it("shows days like Odoo", () => expect(durationLabel(14 * 86400 + 500)).toBe("14d"));
  it("shows hours under a day", () => expect(durationLabel(5 * 3600)).toBe("5h"));
  it("shows <1h under an hour", () => expect(durationLabel(600)).toBe("<1h"));
  it("hides nothing-yet stages", () => {
    expect(durationLabel(null)).toBeUndefined();
    expect(durationLabel(30)).toBeUndefined();
  });
});

describe("splitSteps", () => {
  const steps = ["a", "b", "c", "d", "e"].map((k) => ({ key: k, folded: false }));
  it("overflows past max into the menu", () => {
    const { shown, more } = splitSteps(steps, "a", 3);
    expect(shown.map((s) => s.key)).toEqual(["a", "b", "c"]);
    expect(more.map((s) => s.key)).toEqual(["d", "e"]);
  });
  it("always keeps the current step on the bar", () => {
    const { shown, more } = splitSteps(steps, "e", 3);
    expect(shown.map((s) => s.key)).toEqual(["a", "b", "e"]);
    expect(more.map((s) => s.key)).toEqual(["c", "d"]);
  });
  it("hides folded stages unless current", () => {
    const withFold = [...steps.slice(0, 2), { key: "f", folded: true }];
    expect(splitSteps(withFold, "a", 8).shown.map((s) => s.key)).toEqual(["a", "b"]);
    expect(splitSteps(withFold, "f", 8).shown.map((s) => s.key)).toEqual(["a", "b", "f"]);
  });
});
