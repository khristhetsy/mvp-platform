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

  it("honours a founder's or investor's classic choice", () => {
    expect(resolveLayout("founder", true, true)).toBe("classic");
    expect(resolveLayout("investor", false, true)).toBe("classic");
  });

  it("uses the company-wide admin layout and ignores a per-person choice", () => {
    expect(resolveLayout("admin", true, true)).toBe("topmenu");
    expect(resolveLayout("admin", true, false, "top")).toBe("topmenu");
    expect(resolveLayout("admin", true, false, "side")).toBe("classic");
    expect(resolveLayout("admin", false, false, "side")).toBe("compact");
    expect(resolveLayout("admin", false, true, "top")).toBe("classic");
  });
});
