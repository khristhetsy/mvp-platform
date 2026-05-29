import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/api/errors";
import { requireStaffApi } from "@/lib/api/admin";
import { adminDebug } from "@/lib/debug/admin-debug";
import { setCompanyMarketplaceVisibility } from "@/lib/data/marketplace";
import { writeAuditLog } from "@/lib/data/audit";
import { z } from "zod";

const marketplaceActionSchema = z.object({
  action: z.enum(["publish", "unpublish"]),
});

export async function POST(
  request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await params;

  adminDebug({
    scope: "api.admin.marketplace",
    action: "request_received",
    companyId: id,
    path: `/api/admin/companies/${id}/marketplace`,
  });

  const auth = await requireStaffApi(["admin", "analyst"]);

  if ("error" in auth) {
    adminDebug({
      scope: "api.admin.marketplace",
      companyId: id,
      error: { message: "Staff auth failed." },
    });
    return auth.error as NextResponse;
  }

  const body = await request.json().catch((exception) => {
    adminDebug({ scope: "api.admin.marketplace", companyId: id, exception });
    return null;
  });
  const parsed = marketplaceActionSchema.safeParse(body);

  adminDebug({
    scope: "api.admin.marketplace",
    userId: auth.profile.id,
    userRole: auth.profile.role,
    companyId: id,
    payload: body,
    usingServiceRole: true,
    response: parsed.success ? parsed.data : parsed.error.flatten(),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") || "Invalid request." },
      { status: 400 },
    );
  }

  const { data, error } = await setCompanyMarketplaceVisibility(auth.supabase, {
    companyId: id,
    adminId: auth.profile.id,
    publish: parsed.data.action === "publish",
  });

  if (error) {
    const message = apiErrorMessage(error);
    adminDebug({
      scope: "api.admin.marketplace",
      action: parsed.data.action,
      userId: auth.profile.id,
      userRole: auth.profile.role,
      companyId: id,
      error,
      status: 400,
      response: { error: message },
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: `company.marketplace_${parsed.data.action}`,
    entityType: "company",
    entityId: id,
  });

  adminDebug({
    scope: "api.admin.marketplace",
    action: parsed.data.action,
    userId: auth.profile.id,
    userRole: auth.profile.role,
    companyId: id,
    slug: data?.slug ?? null,
    status: 200,
    response: { company: data },
  });

  return NextResponse.json({ company: data });
}
