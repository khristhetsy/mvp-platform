import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { founderAccessGranted, type FounderAccessRow } from "@/lib/departments/founder-access-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

/**
 * May this staff member use this founder item while acting as a founder? Reads the
 * department switches on Feature Controls, Departments. Fails open: a missing table
 * or a lookup error leaves the default, which is on. Whether staff may act at all is
 * decided elsewhere (act_on_behalf, or Managed by iCFO), this only adds the switches.
 */
export async function staffMayUseFounderItem(staffId: string, itemKey: string): Promise<boolean> {
  try {
    const { data: mem } = await db().from("department_members").select("department_id").eq("user_id", staffId);
    const departmentIds = ((mem ?? []) as Array<{ department_id: string }>).map((m) => m.department_id);
    if (departmentIds.length === 0) return true;
    const { data, error } = await db()
      .from("department_founder_access")
      .select("department_id, item_key, enabled")
      .eq("item_key", itemKey)
      .in("department_id", departmentIds);
    if (error) return true;
    return founderAccessGranted((data ?? []) as FounderAccessRow[], departmentIds, itemKey);
  } catch {
    return true;
  }
}
