import { describe, expect, it } from "vitest";
import { centralActingApplies, effectiveZone, isCentralActingEnabled, sessionExpiryMs, zoneFromReferer } from "@/lib/admin/acting-central-core";

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

  it("reads the zone from the page that made the call", () => {
    expect(zoneFromReferer("https://icapos.com/admin/companies/1")).toBe("admin");
    expect(zoneFromReferer("https://icapos.com/admin")).toBe("admin");
    expect(zoneFromReferer("https://icapos.com/investor/deals")).toBe("investor");
    expect(zoneFromReferer("https://icapos.com/founder/dashboard")).toBe("founder");
    expect(zoneFromReferer("https://icapos.com/administrator")).toBeNull();
    expect(zoneFromReferer("https://icapos.com/")).toBeNull();
    expect(zoneFromReferer("not a url")).toBeNull();
    expect(zoneFromReferer(null)).toBeNull();
  });

  it("prefers the zone header and falls back to the Referer", () => {
    expect(effectiveZone("founder", "https://icapos.com/admin/x")).toBe("founder");
    expect(effectiveZone(null, "https://icapos.com/admin/x")).toBe("admin");
    expect(effectiveZone("", "https://icapos.com/founder/x")).toBe("founder");
    expect(effectiveZone(null, null)).toBeNull();
    // a call from an admin page to a shared route stays on the staff identity
    expect(centralActingApplies(effectiveZone(null, "https://icapos.com/admin/sales"))).toBe(false);
  });
});
