// Sales Hub record scoping. Managers (internal RBAC role manager/admin/super_admin,
// or a legacy platform admin) see every rep's records; everyone else sees only the
// records they own. Enforced server-side in the sales queries.
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { INTERNAL_ROLE_RANK } from "@/lib/rbac/constants";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type SalesScope = { isManager: boolean; ownerId: string | null };

export async function getSalesScope(
  profile: { id: string; role?: string | null; is_super_admin?: boolean | null },
): Promise<SalesScope> {
  try {
    const supabase = createServiceRoleClient();
    const eff = await getEffectivePermissions(supabase, profile.id);
    const slug = eff.roleSlug;
    const isManager =
      eff.isSuperAdmin ||
      (slug != null && INTERNAL_ROLE_RANK[slug] >= INTERNAL_ROLE_RANK.manager) ||
      (slug == null && profile.role === "admin");
    return { isManager, ownerId: isManager ? null : profile.id };
  } catch {
    // Fail open so a lookup error never hides a manager's data.
    return { isManager: true, ownerId: null };
  }
}
