import { describe, expect, it } from "vitest";
import { centralActingApplies, isCentralActingEnabled, sessionExpiryMs } from "@/lib/admin/acting-central-core";

describe("central act on behalf rules", () => {
  it("is off unless the switch is exactly 1", () => {
    expect(isCentralActingEnabled("1")).toBe(true);
    for (const v of [undefined, null, "", "0", "true", "yes", "on"]) expect(isCentralActingEnabled(v)).toBe(false);
  });

  it("leaves admin and investor screens on the staff identity", () => {
    expect(centralActingApplies("admin")).toBe(false);
    expect(centralActingApplies("investor")).toBe(false);
    expect(centralActingApplies("founder")).toBe(true);
    expect(centralActingApplies("")).toBe(true);
    expect(centralActingApplies(null)).toBe(true);
    expect(centralActingApplies(undefined)).toBe(true);
  });

  it("renews the founder session 5 minutes before it expires", () => {
    expect(sessionExpiryMs(3600, 1000)).toBe(1000 + 3600_000 - 300_000);
    expect(sessionExpiryMs(undefined, 0)).toBe(3600_000 - 300_000);
    expect(sessionExpiryMs(60, 0)).toBe(60_000);
  });
});
