import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/api/errors";
import { requireStaffApi } from "@/lib/api/admin";
import { adminDebug } from "@/lib/debug/admin-debug";
import { applyCompanyReview } from "@/lib/data/admin-reviews";
import { writeAuditLog } from "@/lib/data/audit";

export async function POST(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await params;

  adminDebug({
    scope: "api.admin.approve",
    action: "request_received",
    companyId: id,
    path: `/api/admin/companies/${id}/approve`,
  });

  const auth = await requireStaffApi(["admin", "analyst"]);

  if ("error" in auth) {
    adminDebug({
      scope: "api.admin.approve",
      companyId: id,
      error: { message: "Staff auth failed." },
    });
    return auth.error as NextResponse;
  }

  const { data, error } = await applyCompanyReview(auth.supabase, {
    companyId: id,
    adminId: auth.profile.id,
    action: "approve",
  });

  if (error) {
    const message = apiErrorMessage(error);
    adminDebug({
      scope: "api.admin.approve",
      userId: auth.profile.id,
      userRole: auth.profile.role,
      companyId: id,
      usingServiceRole: true,
      error,
      status: 400,
      response: { error: message },
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "company.approved",
    entityType: "company",
    entityId: id,
  });

  adminDebug({
    scope: "api.admin.approve",
    userId: auth.profile.id,
    userRole: auth.profile.role,
    companyId: id,
    slug: data?.company?.slug ?? null,
    status: 200,
    response: data,
  });

  return NextResponse.json(data);
}
