import { describe, it, expect } from "vitest";
import { brandedLink } from "./branded-templates-link";

describe("brandedLink", () => {
  it("reads the copy id from a branded template's blocks", () => {
    expect(brandedLink({ branded: { copy_id: "abc" } })).toEqual({ copy_id: "abc" });
  });
  it("is null for ordinary templates", () => {
    expect(brandedLink(null)).toBeNull();
    expect(brandedLink([{ type: "text" }])).toBeNull();
    expect(brandedLink({ version: 2, blocks: [] })).toBeNull();
  });
});
