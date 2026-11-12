import { describe, expect, it } from "vitest";
import { isSpvClient, normalizeClientType, raiseForInvestors } from "@/lib/listing/client-type";

describe("client type", () => {
  it("reads anything but spv as standard", () => {
    expect(normalizeClientType("spv")).toBe("spv");
    expect(normalizeClientType("standard")).toBe("standard");
    expect(normalizeClientType(null)).toBe("standard");
    expect(normalizeClientType(undefined)).toBe("standard");
    expect(normalizeClientType("SPV")).toBe("standard");
  });

  it("shows a raise amount to investors for SPV clients only", () => {
    expect(isSpvClient("spv")).toBe(true);
    expect(isSpvClient("standard")).toBe(false);
    expect(raiseForInvestors("spv", "Raising $2M")).toBe("Raising $2M");
    expect(raiseForInvestors("standard", "Raising $2M")).toBeNull();
    expect(raiseForInvestors(undefined, 2_000_000)).toBeNull();
  });
});
