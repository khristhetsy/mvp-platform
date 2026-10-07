import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Records a user must hand over before their account can be deleted.
 *
 * These columns are required (NOT NULL) and reference the user without a
 * cascade, so deleting the user is blocked while any row still points at them.
 * Optional "created by / updated by" links clear themselves on delete
 * (migration 20260928090440) and are not listed here. Nothing here is erased
 * except the user's own profile-view log, which only records what they viewed.
 */
export const REQUIRED_OWNERSHIP = [
  { key: "ir_projects_owner", table: "ir_projects", column: "owner_id", label: "Investor Relations projects owned" },
  { key: "ir_projects_created", table: "ir_projects", column: "created_by", label: "Investor Relations projects created" },
  { key: "ir_activities", table: "ir_activities", column: "created_by", label: "Investor Relations activities" },
  { key: "ir_notes", table: "ir_notes", column: "created_by", label: "Investor Relations notes" },
  { key: "ir_reports", table: "ir_reports", column: "created_by", label: "Investor Relations reports" },
  { key: "valuations", table: "valuations", column: "created_by", label: "Valuations" },
] as const;

/** The user's own view history: removed with the user rather than reassigned. */
const OWN_LOGS = [{ table: "profile_view_log", column: "viewer_user_id" }] as const;

export type OwnershipItem = { key: string; label: string; count: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/** Counts of records the user must hand over. Missing tables count as 0. */
export async function countRequiredOwnership(admin: Db, userId: string): Promise<{ items: OwnershipItem[]; total: number }> {
  const items = await Promise.all(
    REQUIRED_OWNERSHIP.map(async (r) => {
      try {
        const { count, error } = await admin.from(r.table).select("*", { count: "exact", head: true }).eq(r.column, userId);
        return { key: r.key, label: r.label, count: error ? 0 : count ?? 0 };
      } catch {
        return { key: r.key, label: r.label, count: 0 };
      }
    }),
  );
  return { items: items.filter((i) => i.count > 0), total: items.reduce((s, i) => s + i.count, 0) };
}

/** Staff who can take over: active admins and analysts other than the user being deleted. */
export async function listSuccessorCandidates(admin: Db, excludeUserId: string): Promise<Array<{ id: string; name: string }>> {
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .in("role", ["admin", "analyst"])
    .eq("is_active", true)
    .neq("id", excludeUserId)
    .order("full_name", { ascending: true });
  return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => ({
    id: p.id,
    name: p.full_name?.trim() || p.email || p.id,
  }));
}

/**
 * Hand every required record from `fromUserId` to `toUserId`, and clear the
 * user's own view log. Returns an error message, or null on success. Each
 * update is independent, so a retry after a partial failure is safe.
 */
export async function transferRequiredOwnership(admin: Db, fromUserId: string, toUserId: string): Promise<string | null> {
  for (const r of REQUIRED_OWNERSHIP) {
    const { error } = await admin.from(r.table).update({ [r.column]: toUserId }).eq(r.column, fromUserId);
    if (error && error.code !== "42P01") return `Could not reassign ${r.label.toLowerCase()}: ${error.message}`;
  }
  for (const l of OWN_LOGS) {
    const { error } = await admin.from(l.table).delete().eq(l.column, fromUserId);
    if (error && error.code !== "42P01") return `Could not clear ${l.table}: ${error.message}`;
  }
  return null;
}

/**
 * Validate the successor and run the transfer when the user has records to
 * hand over. Returns a ready HTTP-style error, or null when the delete can go ahead.
 */
export async function prepareUserDeletion(
  admin: Db,
  userId: string,
  reassignTo: string | null | undefined,
): Promise<{ status: number; error: string; items?: OwnershipItem[] } | null> {
  const owned = await countRequiredOwnership(admin, userId);
  if (owned.total > 0) {
    if (!reassignTo) {
      return {
        status: 409,
        error: "This user still owns records that must be handed to a teammate first. Choose who takes them over.",
        items: owned.items,
      };
    }
    if (reassignTo === userId) return { status: 400, error: "Choose a different teammate to take over." };
    const candidates = await listSuccessorCandidates(admin, userId);
    if (!candidates.some((c) => c.id === reassignTo)) {
      return { status: 400, error: "The teammate chosen to take over must be an active admin or analyst." };
    }
  }
  const failure = await transferRequiredOwnership(admin, userId, reassignTo ?? userId);
  return failure ? { status: 500, error: failure } : null;
}
