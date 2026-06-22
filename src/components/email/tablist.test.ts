import { describe, it, expect } from "vitest";
import { nextTabIndex, isTabNavKey } from "./tablist";

describe("nextTabIndex", () => {
  it("ArrowRight advances and wraps", () => {
    expect(nextTabIndex(0, "ArrowRight", 3)).toBe(1);
    expect(nextTabIndex(2, "ArrowRight", 3)).toBe(0);
  });
  it("ArrowLeft retreats and wraps", () => {
    expect(nextTabIndex(0, "ArrowLeft", 3)).toBe(2);
    expect(nextTabIndex(1, "ArrowLeft", 3)).toBe(0);
  });
  it("Home/End jump to ends", () => {
    expect(nextTabIndex(2, "Home", 3)).toBe(0);
    expect(nextTabIndex(0, "End", 3)).toBe(2);
  });
  it("unrelated keys keep the index; empty list is safe", () => {
    expect(nextTabIndex(1, "Enter", 3)).toBe(1);
    expect(nextTabIndex(0, "ArrowRight", 0)).toBe(0);
  });
});

describe("isTabNavKey", () => {
  it("recognizes navigation keys", () => {
    expect(isTabNavKey("ArrowRight")).toBe(true);
    expect(isTabNavKey("Home")).toBe(true);
    expect(isTabNavKey("Enter")).toBe(false);
  });
});
