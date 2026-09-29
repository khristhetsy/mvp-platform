import type { UserRole } from "./types";

/**
 * Role home routes. Client-safe (no server imports) so public client components
 * like SiteNav can link a signed-in visitor to their workspace.
 */
const dashboardByRole: Record<UserRole, string> = {
  founder: "/founder",
  investor: "/investor/dashboard",
  admin: "/admin",
  analyst: "/admin",
};

export function dashboardForRole(role: UserRole) {
  return dashboardByRole[role];
}
