/**
 * The ONE way to change crm_contacts.overrides.
 *
 * Every writer used to read the column, spread a patch over it in JS, and write the whole
 * thing back. That is a lost-update race: the derivation cron and a staff Approve on the
 * same contact interleave as read/read/write/write, and the second write silently erases
 * the first. It was also the shape behind today's worst bug - a failed read spread `{}`
 * and the write wiped every value on the contact.
 *
 * merge_contact_overrides (migration 20260913002) does `overrides || patch - remove` in
 * Postgres, atomically per row. Nothing here reads before writing, so there is nothing
 * to race and nothing to wipe.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { reportDbError } from "@/lib/supabase/report";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type OverridesPatch = {
  /** Keys to set. Values replace any existing value for that key. */
  set?: Record<string, unknown>;
  /** Keys to delete outright (e.g. a provenance tag, or an undone field). */
  remove?: string[];
};

/**
 * Apply a patch to one contact's overrides. Returns the resulting overrides, or null on
 * failure (already reported). Never throws - callers decide whether a failure is fatal.
 */
export async function mergeOverrides(contactId: string, patch: OverridesPatch, context = "mergeOverrides"): Promise<Record<string, unknown> | null> {
  const p_patch = patch.set ?? {};
  const p_remove = patch.remove ?? [];
  if (Object.keys(p_patch).length === 0 && p_remove.length === 0) return null;
  const { data, error } = await db().rpc("merge_contact_overrides", { p_id: contactId, p_patch, p_remove });
  if (reportDbError(`${context}: merge_contact_overrides`, error)) return null;
  return (data ?? {}) as Record<string, unknown>;
}
