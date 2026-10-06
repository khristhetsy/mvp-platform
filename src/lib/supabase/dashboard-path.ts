import type { UserRole } from "./types";

/**
 * Role home routes. Client-safe (no server imports) so public client components
 * like SiteNav can link a signed-in visitor to their workspace.
 */
const dashboardByRole: Record<UserRole, string> = {
  founder: "/founder",
  investor: "/investor/dashboard",
  // Admins go through the start page, which follows the company-wide setting (Home grid or Dashboard).
  admin: "/admin/start",
  analyst: "/admin/start",
};

export function dashboardForRole(role: UserRole) {
  return dashboardByRole[role];
}
