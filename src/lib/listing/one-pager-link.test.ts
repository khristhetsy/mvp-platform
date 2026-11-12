import { describe, expect, it } from "vitest";
import { founderOnePagerPath, showSeekingAmount } from "./one-pager-link";

describe("founderOnePagerPath", () => {
  it("marks the link as sent by the founder", () => {
    expect(founderOnePagerPath("cogs")).toBe("/f/cogs?src=founder");
  });
});

describe("showSeekingAmount", () => {
  it("shows the amount when the founder sent the link", () => {
    expect(showSeekingAmount({ isSpv: false, source: "founder" })).toBe(true);
  });
  it("hides the amount for iCapOS links and direct visits", () => {
    expect(showSeekingAmount({ isSpv: false, source: undefined })).toBe(false);
    expect(showSeekingAmount({ isSpv: false, source: null })).toBe(false);
    expect(showSeekingAmount({ isSpv: false, source: "icapos" })).toBe(false);
  });
  it("always shows the amount for SPV clients", () => {
    expect(showSeekingAmount({ isSpv: true, source: undefined })).toBe(true);
    expect(showSeekingAmount({ isSpv: true, source: "icapos" })).toBe(true);
  });
  it("reads the first value when the marker is repeated", () => {
    expect(showSeekingAmount({ isSpv: false, source: ["founder", "x"] })).toBe(true);
    expect(showSeekingAmount({ isSpv: false, source: ["x", "founder"] })).toBe(false);
  });
});
