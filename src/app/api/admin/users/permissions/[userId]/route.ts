import { NextResponse } from "next/server";
import { requireManageUsersApi } from "@/lib/api/permissions";
import { listInternalUsers, updateInternalUserPermissions } from "@/lib/rbac/internal-users";
import { isInternalPermission, isInternalRoleSlug, type InternalPermission, type InternalRoleSlug } from "@/lib/rbac/constants";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireManageUsersApi();
  if ("error" in auth) return auth.error;

  const { userId } = await context.params;
  const users = await listInternalUsers(auth.supabase);
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return NextResponse.json({ error: "Internal user not found." }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireManageUsersApi();
  if ("error" in auth) return auth.error;

  const { userId } = await context.params;

  let body: {
    roleSlug?: string;
    isActive?: boolean;
    overrides?: Array<{ permission: string; granted: boolean | null }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.roleSlug && !isInternalRoleSlug(body.roleSlug)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  if (body.overrides) {
    for (const override of body.overrides) {
      if (!isInternalPermission(override.permission)) {
        return NextResponse.json({ error: `Invalid permission: ${override.permission}` }, { status: 400 });
      }
    }
  }

  try {
    const effective = await updateInternalUserPermissions(auth.supabase, auth.userId, userId, {
      roleSlug: body.roleSlug as InternalRoleSlug | undefined,
      isActive: body.isActive,
      overrides: body.overrides?.map((o) => ({
        permission: o.permission as InternalPermission,
        granted: o.granted,
      })),
    });

    const users = await listInternalUsers(auth.supabase);
    const user = users.find((u) => u.id === userId);

    return NextResponse.json({ user, effectivePermissions: effective.permissions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update permissions." },
      { status: 400 },
    );
  }
}
