import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireManageUsersApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/supabase/types";

type ServiceClient = SupabaseClient<Database>;

const ROLES: UserRole[] = ["founder", "investor", "admin", "analyst"];

/**
 * Returns true if `userId` is the last active admin — i.e. removing their admin
 * access (deactivate, delete, or demote) would leave nobody able to manage the
 * platform. Guards against an accidental full lockout.
 */
async function isLastActiveAdmin(admin: ServiceClient, userId: string): Promise<boolean> {
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true)
    .neq("id", userId);
  return (count ?? 0) === 0;
}

function formatLastSeen(ts: string | null | undefined): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString();
}

// GET — list all users with last_sign_in from auth
export async function GET() {
  const auth = await requireManageUsersApi();
  if ("error" in auth) return auth.error as Response;

  const admin = createServiceRoleClient();

  const [profilesRes, authUsersRes, auditRes] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, role, is_active, last_seen_at, created_at, is_super_admin").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("audit_logs")
      .select("id, user_id, action, metadata, created_at")
      .in("action", ["admin.user_role_changed", "admin.user_deactivated", "admin.user_reactivated", "admin.staff_invited"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (profilesRes.error) {
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }

  const authMap = new Map<string, { last_sign_in_at: string | null; invited_at: string | null }>();
  for (const u of authUsersRes.data?.users ?? []) {
    authMap.set(u.id, { last_sign_in_at: u.last_sign_in_at ?? null, invited_at: u.invited_at ?? null });
  }

  // Actor display names, resolved from the profiles we just fetched (avoids a
  // fragile embedded join on audit_logs.user_id → profiles).
  const nameById = new Map<string, string>();
  for (const p of profilesRes.data ?? []) {
    nameById.set(p.id, p.full_name ?? p.email ?? "Unknown");
  }

  const users = (profilesRes.data ?? []).map((p) => {
    const auth = authMap.get(p.id);
    const lastSeen = p.last_seen_at ?? auth?.last_sign_in_at ?? null;
    const isPending = !auth?.last_sign_in_at && !!auth?.invited_at;
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: p.role as UserRole,
      is_active: p.is_active ?? true,
      is_super_admin: p.is_super_admin ?? false,
      last_seen_at: lastSeen,
      last_seen_label: formatLastSeen(lastSeen),
      status: !p.is_active ? "inactive" : isPending ? "invited" : "active",
      created_at: p.created_at,
    };
  });

  const auditEntries = (auditRes.data ?? []).map((entry) => ({
    id: entry.id,
    action: entry.action,
    metadata: entry.metadata,
    created_at: entry.created_at,
    actor_name: (entry.user_id && nameById.get(entry.user_id)) || "Unknown",
  }));

  return NextResponse.json({ users, audit: auditEntries, roles: ROLES });
}

// DELETE — hard-delete user from Supabase Auth + profiles
export async function DELETE(req: NextRequest): Promise<Response> {
  const auth = await requireManageUsersApi();
  if ("error" in auth) return auth.error as Response;

  const body = await req.json().catch(() => ({}));
  const userId = body.userId;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required." }, { status: 400 });
  }
  if (userId === auth.userId) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const { data: target } = await admin
    .from("profiles")
    .select("role, is_super_admin, full_name, email")
    .eq("id", userId)
    .single();

  if (target?.is_super_admin) {
    return NextResponse.json({ error: "Cannot delete a super admin account." }, { status: 403 });
  }

  if (target?.role === "admin" && (await isLastActiveAdmin(admin, userId))) {
    return NextResponse.json(
      { error: "Cannot delete the last active admin — promote another admin first." },
      { status: 409 }
    );
  }

  // Hard-delete from Supabase Auth (profiles row cascades via FK)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    const msg = deleteError.message?.toLowerCase() ?? "";
    // If auth user already gone, still clean up the profile row
    if (!msg.includes("not found") && !msg.includes("user not found")) {
      return NextResponse.json({ error: deleteError.message ?? "Delete failed." }, { status: 500 });
    }
    // Auth user missing — delete profile manually
    await admin.from("profiles").delete().eq("id", userId);
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.userId,
    action: "admin.user_deleted",
    entityType: "profile",
    entityId: userId,
    metadata: { targetEmail: target?.email, targetName: target?.full_name },
  });

  return NextResponse.json({ success: true });
}

// PATCH — update role or is_active
const patchSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["founder", "investor", "admin", "analyst"]).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest): Promise<Response> {
  const auth = await requireManageUsersApi();
  if ("error" in auth) return auth.error as Response;

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { userId, role, is_active } = parsed.data;
  const admin = createServiceRoleClient();

  // Prevent editing super admins
  const { data: target, error: targetError } = await admin.from("profiles").select("role, is_super_admin, full_name, email").eq("id", userId).single();
  if (targetError) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target?.is_super_admin && auth.userId !== userId) {
    return NextResponse.json({ error: "Cannot modify a super admin account." }, { status: 403 });
  }

  // Lockout guard: don't let the last active admin lose admin access.
  const deactivatingAdmin = is_active === false && target?.role === "admin";
  const demotingAdmin = role !== undefined && role !== "admin" && target?.role === "admin";
  if ((deactivatingAdmin || demotingAdmin) && (await isLastActiveAdmin(admin, userId))) {
    return NextResponse.json(
      {
        error: deactivatingAdmin
          ? "Cannot deactivate the last active admin — promote another admin first."
          : "Cannot remove admin from the last active admin — promote another admin first.",
      },
      { status: 409 }
    );
  }

  const update: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (role !== undefined) update.role = role;
  if (is_active !== undefined) update.is_active = is_active;

  const { error: updateError } = await admin.from("profiles").update(update).eq("id", userId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message ?? "Update failed." }, { status: 500 });
  }

  // Audit
  if (role !== undefined) {
    await writeAuditLog(auth.supabase, {
      userId: auth.userId,
      action: "admin.user_role_changed",
      entityType: "profile",
      entityId: userId,
      metadata: { targetEmail: target?.email, previousRole: target?.role, newRole: role },
    });
  }
  if (is_active !== undefined) {
    await writeAuditLog(auth.supabase, {
      userId: auth.userId,
      action: is_active ? "admin.user_reactivated" : "admin.user_deactivated",
      entityType: "profile",
      entityId: userId,
      metadata: { targetEmail: target?.email, targetName: target?.full_name },
    });
  }

  return NextResponse.json({ success: true });
}
