/**
 * The sector keys events are built on.
 */
import { describe, it, expect } from "vitest";
import {
  EVENT_SECTORS,
  isSeededSectorSlug,
  isValidSectorSlug,
  sectorLabel,
} from "@/lib/icfo-events/sectors";

describe("validating a sector key", () => {
  // The check used to be membership of the fourteen hardcoded sectors, which
  // meant an industry added on the admin page could be picked in the event
  // editor and then rejected on save with "Unknown sector".
  it("accepts a key added after this file was written", () => {
    expect(isValidSectorSlug("nuclear-waste-recycling")).toBe(true);
    expect(isValidSectorSlug("quantum-computing")).toBe(true);
  });

  it("still accepts the ones it shipped with", () => {
    for (const s of EVENT_SECTORS) expect(isValidSectorSlug(s.slug)).toBe(true);
  });

  it("refuses anything that is not a key", () => {
    expect(isValidSectorSlug("FinTech")).toBe(false);
    expect(isValidSectorSlug("ai ml")).toBe(false);
    expect(isValidSectorSlug("-leading")).toBe(false);
    expect(isValidSectorSlug("trailing-")).toBe(false);
    expect(isValidSectorSlug("double--hyphen")).toBe(false);
    expect(isValidSectorSlug("")).toBe(false);
  });

  it("still knows which ones it shipped with", () => {
    expect(isSeededSectorSlug("fintech")).toBe(true);
    expect(isSeededSectorSlug("quantum-computing")).toBe(false);
  });
});

describe("labelling a sector", () => {
  it("names one it shipped with", () => {
    expect(sectorLabel("ai-ml")).toBe("AI / ML");
  });

  it("leaves an unknown key alone rather than rendering blank", () => {
    expect(sectorLabel("quantum-computing")).toBe("quantum-computing");
  });
});
