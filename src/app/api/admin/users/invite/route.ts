import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireManageUsersApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { getAppUrl } from "@/lib/env";

const inviteSchema = z.object({
  email: z.string().email("Valid email required."),
  role: z.enum(["admin", "analyst"]),
  fullName: z.string().max(120).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const auth = await requireManageUsersApi();
  if ("error" in auth) return auth.error as Response;

  const body = await req.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email, role, fullName } = parsed.data;
  const admin = createServiceRoleClient();

  // Check if user already exists
  const { data: existing } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `A user with this email already exists (role: ${existing.role}).` },
      { status: 409 },
    );
  }

  const redirectTo = `${getAppUrl() ?? "http://localhost:3000"}/auth/accept-invite`;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      role,
      full_name: fullName ?? null,
    },
    redirectTo,
  });

  if (inviteError) {
    return NextResponse.json(
      { error: inviteError.message ?? "Failed to send invite." },
      { status: 500 },
    );
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.userId,
    action: "admin.staff_invited",
    entityType: "profile",
    entityId: invited.user?.id ?? null,
    metadata: { email, role, fullName: fullName ?? null },
  });

  return NextResponse.json({ success: true, email, role });
}
