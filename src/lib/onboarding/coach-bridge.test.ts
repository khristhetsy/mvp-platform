import { describe, expect, it } from "vitest";
import { parseCoachPick } from "./coach-bridge";

describe("parseCoachPick", () => {
  it("rejects anything that is not a funding band pick", () => {
    expect(parseCoachPick(null)).toBeNull();
    expect(parseCoachPick({ field: "stage", value: "x" })).toBeNull();
    expect(parseCoachPick({ field: "amount", value: "not-a-band" })).toBeNull();
    expect(parseCoachPick({ field: "amount", value: 5 })).toBeNull();
  });
});
