import { describe, expect, it } from "vitest";
import { ADMIN_HOME_STYLES, DEFAULT_ADMIN_HOME, adminStartPath, normalizeAdminHome } from "./admin-home-shape";

describe("normalizeAdminHome", () => {
  it("falls back to the defaults for anything missing or invalid", () => {
    expect(normalizeAdminHome(null)).toEqual(DEFAULT_ADMIN_HOME);
    expect(normalizeAdminHome({ style: 0, layout: "diagonal", startPage: "nowhere" })).toEqual(DEFAULT_ADMIN_HOME);
    expect(normalizeAdminHome({ style: 11 }).style).toBe(1);
    expect(normalizeAdminHome({ style: 2.5 }).style).toBe(1);
  });

  it("keeps valid choices", () => {
    expect(normalizeAdminHome({ style: 10, layout: "side", startPage: "dashboard" })).toEqual({ style: 10, layout: "side", startPage: "dashboard" });
    expect(normalizeAdminHome({ style: "7" }).style).toBe(7);
  });

  it("has the 10 approved styles", () => {
    expect(ADMIN_HOME_STYLES).toHaveLength(10);
  });
});

describe("adminStartPath", () => {
  it("sends admins to the Home grid or the Dashboard", () => {
    expect(adminStartPath({ ...DEFAULT_ADMIN_HOME, startPage: "home" })).toBe("/admin/home");
    expect(adminStartPath({ ...DEFAULT_ADMIN_HOME, startPage: "dashboard" })).toBe("/admin");
  });
});
