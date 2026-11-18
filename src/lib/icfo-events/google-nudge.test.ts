import { describe, expect, it } from "vitest";
import { needsGoogleNudge } from "./google-nudge";

describe("needsGoogleNudge", () => {
  it("nudges an account without Google", () => {
    expect(needsGoogleNudge(["a"], [])).toBe(true);
  });
  it("does not nudge once any of their accounts has Google", () => {
    expect(needsGoogleNudge(["a", "b"], ["b"])).toBe(false);
  });
  it("does not nudge someone with no account", () => {
    expect(needsGoogleNudge([], [])).toBe(false);
  });
  it("ignores other people's connections", () => {
    expect(needsGoogleNudge(["a"], ["z"])).toBe(true);
  });
});
