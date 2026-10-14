/**
 * Who gets the gear menu on the Investor Relations Tasks columns (Fold, Edit, Delete, Archive All,
 * Unarchive All): Super Admins always, every admin, anyone with the Manager role or higher, and members
 * of the Investor Relations department. Everyone else keeps the plain fold arrow and the plus.
 * Fails closed: if the lookup errors, nobody gets the menu.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { INTERNAL_ROLE_RANK, type InternalRoleSlug } from "@/lib/rbac/constants";

export const IR_DEPARTMENT_KEY = "investor_relations";

export function columnMenuAllowed(a: { isSuperAdmin: boolean; roleSlug: InternalRoleSlug | null; inIrDepartment: boolean; isAdminProfile?: boolean }): boolean {
  if (a.isSuperAdmin || a.inIrDepartment || a.isAdminProfile) return true;
  return !!a.roleSlug && INTERNAL_ROLE_RANK[a.roleSlug] >= INTERNAL_ROLE_RANK.manager;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- department tables aren't in the generated types
function db(): any { return createServiceRoleClient(); }

export async function canUseIrColumnMenu(userId: string): Promise<boolean> {
  try {
    const supabase = db();
    const eff = await getEffectivePermissions(supabase, userId);
    if (eff.isSuperAdmin) return true;
    const { data: mem } = await supabase.from("department_members").select("department_id").eq("user_id", userId);
    const deptIds = ((mem ?? []) as Array<{ department_id: string }>).map((m) => m.department_id);
    let inIrDepartment = false;
    if (deptIds.length) {
      const { data } = await supabase.from("departments").select("id").eq("key", IR_DEPARTMENT_KEY).eq("is_active", true).in("id", deptIds);
      inIrDepartment = ((data ?? []) as unknown[]).length > 0;
    }
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const isAdminProfile = String(prof?.role ?? "").toLowerCase() === "admin"; // legacy admins with no Manager role row
    return columnMenuAllowed({ isSuperAdmin: eff.isSuperAdmin, roleSlug: eff.roleSlug, inIrDepartment, isAdminProfile });
  } catch {
    return false;
  }
}
