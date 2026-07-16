// Resolve the owner filter for Forecast views. Regular members are always scoped to
// their own pipeline. Admins (isManager) default to the org-wide roll-up (null), but
// may switch to "mine" to see just their own — driven by the ?scope=mine|all param.
import type { SalesScope } from "@/lib/sales/scope";

export function forecastOwnerId(scope: SalesScope, profileId: string, param: string | null | undefined): string | null {
  if (!scope.isManager) return scope.ownerId; // members: own pipeline only
  return param === "mine" ? profileId : null; // admins: their own, or all
}
