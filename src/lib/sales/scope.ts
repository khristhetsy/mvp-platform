// Sales Hub record scoping. Only Admins (internal RBAC role admin/super_admin, or a
// legacy platform admin) see every rep's records and may assign contacts; everyone
// else — including plain managers — sees only the records they own. Enforced
// server-side in the sales queries. `isManager` here means "admin-tier / sees all".
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
    const isAdmin =
      eff.isSuperAdmin ||
      (slug != null && INTERNAL_ROLE_RANK[slug] >= INTERNAL_ROLE_RANK.admin) ||
      (slug == null && profile.role === "admin");
    return { isManager: isAdmin, ownerId: isAdmin ? null : profile.id };
  } catch {
    // Fail closed: on a lookup error, scope to the user's own records rather than
    // exposing everyone's. Assign controls also stay hidden.
    return { isManager: false, ownerId: profile.id };
  }
}
