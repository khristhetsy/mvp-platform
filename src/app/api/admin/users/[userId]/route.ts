import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { writeAuditLog } from "@/lib/data/audit";
import type { Profile } from "@/lib/supabase/types";
import { prepareUserDeletion } from "@/lib/users/ownership-transfer";

type RouteContext = { params: Promise<{ userId: string }> };

export async function DELETE(req: Request, { params }: RouteContext) {
  const { userId: targetUserId } = await params;

  const userSupabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // Load actor's effective permissions
  const admin = createServiceRoleClient();
  const { data: actorProfileRaw } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const actorProfile = actorProfileRaw as (Profile & { is_super_admin?: boolean }) | null;

  if (!actorProfile) {
    return NextResponse.json({ error: "Actor profile not found." }, { status: 403 });
  }

  const effective = await getEffectivePermissions(admin, user.id, actorProfile);

  if (!effective.isSuperAdmin) {
    return NextResponse.json(
      { error: "Only super admins can delete user accounts." },
      { status: 403 },
    );
  }

  // Prevent self-deletion
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  // Fetch target user info for audit log
  const { data: targetProfileRaw } = await admin
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", targetUserId)
    .single();

  if (!targetProfileRaw) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const targetProfile = targetProfileRaw as { email: string | null; full_name: string | null; role: string };

  // Prevent deletion of other super admins
  const { data: targetProfileFull } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", targetUserId)
    .single();

  if ((targetProfileFull as { is_super_admin?: boolean } | null)?.is_super_admin) {
    return NextResponse.json({ error: "You cannot delete a super admin account." }, { status: 403 });
  }

  // Records only this user can own (IR projects, notes, reports, valuations)
  // block the delete; hand them to the chosen teammate first.
  const body = (await req.json().catch(() => ({}))) as { reassignTo?: unknown };
  const reassignTo = typeof body.reassignTo === "string" && body.reassignTo ? body.reassignTo : null;
  const blocked = await prepareUserDeletion(admin, targetUserId, reassignTo);
  if (blocked) {
    return NextResponse.json({ error: blocked.error, mustReassign: blocked.items }, { status: blocked.status });
  }

  // Write audit log before deletion (so the actor record still exists)
  await writeAuditLog(admin, {
    userId: user.id,
    action: "admin.user_deleted",
    entityType: "profile",
    entityId: targetUserId,
    metadata: {
      targetEmail: targetProfile.email,
      targetName: targetProfile.full_name,
      targetRole: targetProfile.role,
      reassignedTo: reassignTo,
    },
  });

  // Delete auth user via service role (cascades to profiles + related data via FK)
  const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message ?? "Failed to delete user." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
