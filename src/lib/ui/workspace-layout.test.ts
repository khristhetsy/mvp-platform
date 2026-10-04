import { describe, expect, it } from "vitest";
import { resolveLayout } from "./workspace-layout";

describe("resolveLayout", () => {
  it("uses the top menu when the workspace flag is on", () => {
    expect(resolveLayout("admin", true, false)).toBe("topmenu");
    expect(resolveLayout("founder", true, false)).toBe("topmenu");
    expect(resolveLayout("investor", true, false)).toBe("topmenu");
  });

  it("keeps today's layouts when the flag is off", () => {
    expect(resolveLayout("admin", false, false)).toBe("compact");
    expect(resolveLayout("founder", false, false)).toBe("classic");
    expect(resolveLayout("investor", false, false)).toBe("classic");
  });

  it("honours a person's classic choice either way", () => {
    expect(resolveLayout("admin", true, true)).toBe("classic");
    expect(resolveLayout("founder", false, true)).toBe("classic");
  });
});
