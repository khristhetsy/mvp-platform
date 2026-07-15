// Sales Hub record scoping. Only Admins (internal RBAC role admin/super_admin, or a
// legacy platform admin) see every rep's records and may assign contacts; everyone
// else — including plain managers — sees only the records they own. Enforced
// server-side in the sales queries. `isManager` here means "admin-tier / sees all".
//
// Contact visibility has an extra, department-level rule: members of the Admin
// department, or of any department flagged `contacts_see_all` (e.g. Marketing), can
// see ALL contacts even though they aren't admins. That's `canSeeAllContacts` — it
// governs the Contacts list/counts only, never opportunity/forecast scoping or the
// assignment controls (those stay keyed to `isManager`).
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { INTERNAL_ROLE_RANK } from "@/lib/rbac/constants";
import { createServiceRoleClient, serviceRoleClientUntyped } from "@/lib/supabase/admin";

export type SalesScope = { isManager: boolean; canSeeAllContacts: boolean; ownerId: string | null };

// Does the user belong to the Admin department or any department that has been granted
// "see all contacts"? Failure → false (fail closed to the user's own records).
async function departmentSeesAllContacts(userId: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = serviceRoleClientUntyped();
    const { data: mem } = await db.from("department_members").select("department_id").eq("user_id", userId);
    const ids = ((mem ?? []) as Array<{ department_id: string }>).map((m) => m.department_id);
    if (ids.length === 0) return false;
    const { data: depts } = await db
      .from("departments")
      .select("id")
      .in("id", ids)
      .or("is_admin.eq.true,contacts_see_all.eq.true");
    return ((depts ?? []) as unknown[]).length > 0;
  } catch {
    return false;
  }
}

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
    const canSeeAllContacts = isAdmin || (await departmentSeesAllContacts(profile.id));
    return { isManager: isAdmin, canSeeAllContacts, ownerId: isAdmin ? null : profile.id };
  } catch {
    // Fail closed: on a lookup error, scope to the user's own records rather than
    // exposing everyone's. Assign controls also stay hidden.
    return { isManager: false, canSeeAllContacts: false, ownerId: profile.id };
  }
}
