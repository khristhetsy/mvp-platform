import { NextResponse } from "next/server";
import { requireManageUsersApi } from "@/lib/api/permissions";
import { listInternalUsers } from "@/lib/rbac/internal-users";
import { loadRbacCatalog } from "@/lib/rbac/effective-permissions";

export async function GET() {
  const auth = await requireManageUsersApi();
  if ("error" in auth) return auth.error;

  try {
    const [users, catalog] = await Promise.all([
      listInternalUsers(auth.supabase),
      loadRbacCatalog(auth.supabase),
    ]);

    return NextResponse.json({
      users,
      roles: catalog.roles,
      permissions: catalog.permissions,
      rolePermissions: Object.fromEntries(
        [...catalog.rolePermissionMap.entries()].map(([slug, perms]) => [slug, [...perms]]),
      ),
      actor: {
        userId: auth.userId,
        isSuperAdmin: auth.effective.isSuperAdmin,
        roleSlug: auth.effective.roleSlug,
        permissions: auth.effective.permissions,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load internal users." },
      { status: 500 },
    );
  }
}
