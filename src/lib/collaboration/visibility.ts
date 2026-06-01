import type { CollaborationVisibility } from "@/lib/collaboration/types";
import type { Profile, UserRole } from "@/lib/supabase/types";

export function isStaffRole(role: UserRole | string): boolean {
  return role === "admin" || role === "analyst";
}

export function canViewComment(profile: Profile, visibility: CollaborationVisibility): boolean {
  if (isStaffRole(profile.role)) return true;
  if (profile.role === "founder") {
    return visibility === "company_team";
  }
  if (profile.role === "investor") {
    return visibility === "investor_related";
  }
  return false;
}

export function allowedVisibilitiesForRole(role: UserRole | string): CollaborationVisibility[] {
  if (isStaffRole(role)) {
    return ["admin_only", "internal", "company_team", "investor_related"];
  }
  if (role === "founder") {
    return ["company_team"];
  }
  if (role === "investor") {
    return ["investor_related"];
  }
  return [];
}

export function defaultVisibilityForRole(role: UserRole | string): CollaborationVisibility {
  if (isStaffRole(role)) return "internal";
  if (role === "founder") return "company_team";
  if (role === "investor") return "investor_related";
  return "admin_only";
}

export function visibilityLabel(visibility: CollaborationVisibility): string {
  switch (visibility) {
    case "admin_only":
      return "Admin only";
    case "internal":
      return "Internal";
    case "company_team":
      return "Company team";
    case "investor_related":
      return "Investor related";
    default:
      return visibility;
  }
}
