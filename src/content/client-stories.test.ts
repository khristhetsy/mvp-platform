import { describe, expect, it } from "vitest";
import { clientSpotlight, spotlightApproved } from "./client-stories";

describe("client spotlight", () => {
  it("carries a permission date and a rising score pair", () => {
    expect(spotlightApproved()).toBe(true);
    expect(clientSpotlight.crrCurrent).toBeGreaterThan(clientSpotlight.crrStart);
  });
  it("is hidden without a permission date", () => {
    expect(spotlightApproved({ ...clientSpotlight, approvedOn: "" })).toBe(false);
  });
  it("points photo and logo at files kept in public/marketing/clients", () => {
    expect(clientSpotlight.photoUrl).toMatch(/^\/marketing\/clients\//);
    expect(clientSpotlight.logoUrl).toMatch(/^\/marketing\/clients\//);
  });
  it("spells the company as Impervitex Corp.", () => {
    expect(clientSpotlight.company).toBe("Impervitex Corp.");
  });
});
