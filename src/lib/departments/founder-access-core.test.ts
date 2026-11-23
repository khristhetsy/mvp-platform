import { describe, expect, it } from "vitest";
import { founderAccessGranted, ACTING_TERMS_KEY, ACTING_SOCIAL_KEY } from "./founder-access-core";

const row = (department_id: string, item_key: string, enabled: boolean) => ({ department_id, item_key, enabled });

describe("founderAccessGranted", () => {
  it("allows unassigned staff", () => {
    expect(founderAccessGranted([row("d1", ACTING_SOCIAL_KEY, false)], [], ACTING_SOCIAL_KEY)).toBe(true);
  });

  it("treats a missing row as on, so new menu items open by default", () => {
    expect(founderAccessGranted([], ["d1"], "/founder/new-page")).toBe(true);
  });

  it("denies when the department switch is off", () => {
    expect(founderAccessGranted([row("d1", ACTING_TERMS_KEY, false)], ["d1"], ACTING_TERMS_KEY)).toBe(false);
  });

  it("allows when the department switch is on", () => {
    expect(founderAccessGranted([row("d1", ACTING_TERMS_KEY, true)], ["d1"], ACTING_TERMS_KEY)).toBe(true);
  });

  it("only denies a multi department member when every department is off", () => {
    const rows = [row("d1", ACTING_TERMS_KEY, false), row("d2", ACTING_TERMS_KEY, true)];
    expect(founderAccessGranted(rows, ["d1", "d2"], ACTING_TERMS_KEY)).toBe(true);
    expect(founderAccessGranted([row("d1", ACTING_TERMS_KEY, false), row("d2", ACTING_TERMS_KEY, false)], ["d1", "d2"], ACTING_TERMS_KEY)).toBe(false);
  });

  it("ignores switches for other items and other departments", () => {
    expect(founderAccessGranted([row("d9", ACTING_TERMS_KEY, false), row("d1", ACTING_SOCIAL_KEY, false)], ["d1"], ACTING_TERMS_KEY)).toBe(true);
  });
});
