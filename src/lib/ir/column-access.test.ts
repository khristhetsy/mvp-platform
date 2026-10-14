import { describe, expect, it } from "vitest";
import { columnMenuAllowed } from "./column-access";

describe("columnMenuAllowed", () => {
  it("always allows a super admin", () => {
    expect(columnMenuAllowed({ isSuperAdmin: true, roleSlug: null, inIrDepartment: false })).toBe(true);
  });
  it("allows the Investor Relations department", () => {
    expect(columnMenuAllowed({ isSuperAdmin: false, roleSlug: "regular_user", inIrDepartment: true })).toBe(true);
  });
  it("allows Manager and Admin roles", () => {
    expect(columnMenuAllowed({ isSuperAdmin: false, roleSlug: "manager", inIrDepartment: false })).toBe(true);
    expect(columnMenuAllowed({ isSuperAdmin: false, roleSlug: "admin", inIrDepartment: false })).toBe(true);
  });
  it("allows an admin profile that has no role row", () => {
    expect(columnMenuAllowed({ isSuperAdmin: false, roleSlug: null, inIrDepartment: false, isAdminProfile: true })).toBe(true);
  });
  it("blocks a regular user outside the department, and users with no role", () => {
    expect(columnMenuAllowed({ isSuperAdmin: false, roleSlug: "regular_user", inIrDepartment: false })).toBe(false);
    expect(columnMenuAllowed({ isSuperAdmin: false, roleSlug: null, inIrDepartment: false })).toBe(false);
  });
});
