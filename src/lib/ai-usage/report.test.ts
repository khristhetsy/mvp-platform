import { describe, expect, it } from "vitest";
import { usageStatus } from "./report";

describe("usageStatus", () => {
  it("treats a null cap as unlimited", () => {
    expect(usageStatus(40, null)).toBe("unlimited");
  });

  it("is within the cap below 80 percent", () => {
    expect(usageStatus(3, 5)).toBe("within");
    expect(usageStatus(0, 5)).toBe("within");
  });

  it("is near the cap from 80 percent up to the cap", () => {
    expect(usageStatus(4, 5)).toBe("near");
    expect(usageStatus(12, 15)).toBe("near");
  });

  it("is at the limit when the next run would be blocked", () => {
    expect(usageStatus(5, 5)).toBe("at_limit");
  });

  it("is over the limit when runs exceed the cap", () => {
    expect(usageStatus(6, 5)).toBe("over");
  });

  it("does not divide by a zero cap", () => {
    expect(usageStatus(0, 0)).toBe("at_limit");
    expect(usageStatus(1, 0)).toBe("over");
  });
});
