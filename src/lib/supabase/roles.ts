import type { UserRole } from "@/lib/supabase/types";
import type { Role } from "@/lib/auth";

export function toShellRole(role: UserRole | null | undefined): Role {
  if (!role) {
    return "FOUNDER";
  }

  return role.toUpperCase() as Role;
}

export function viewerRoleFromProfile(role: UserRole | null | undefined): UserRole | null {
  if (!role) {
    return null;
  }

  return role;
}
