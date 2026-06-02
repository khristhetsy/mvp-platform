import type { UserRole } from "@/lib/supabase/types";

const PUBLIC_SIGNUP_ROLES = new Set<UserRole>(["founder", "investor"]);

/** Roles assignable via public signup, OAuth metadata, or create-profile. */
export function sanitizePublicSignupRole(value: unknown): UserRole {
  if (typeof value === "string" && PUBLIC_SIGNUP_ROLES.has(value as UserRole)) {
    return value as UserRole;
  }

  return "founder";
}

export function profileRoleFromPublicMetadata(value: unknown): UserRole | null {
  if (typeof value === "string" && PUBLIC_SIGNUP_ROLES.has(value as UserRole)) {
    return value as UserRole;
  }

  return null;
}

export function isStaffAssignableRole(value: unknown): value is UserRole {
  return value === "admin" || value === "analyst" || value === "super_admin";
}
