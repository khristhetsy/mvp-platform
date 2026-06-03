import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/api/errors";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { updateAdminInvestorPipeline } from "@/lib/investor-crm/admin-pipeline";
import { adminInvestorPipelineUpdateSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await params;
  const auth = await requireStaffApi(["admin", "analyst"]);

  if ("error" in auth) {
    return auth.error as NextResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = adminInvestorPipelineUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pipeline update payload." }, { status: 400 });
  }

  const result = await updateAdminInvestorPipeline(auth.supabase, id, parsed.data, {
    defaultOwnerAdminId: auth.profile.id,
  });

  if (result.error) {
    return NextResponse.json({ error: apiErrorMessage(result.error) }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.investor_pipeline_updated",
    entityType: "investor_pipeline",
    entityId: id,
    metadata: {
      investor_id: result.data?.investor_id,
      company_id: result.data?.company_id,
      stage: result.data?.stage,
      fields: Object.keys(parsed.data),
    },
  });

  return NextResponse.json({ ok: true, pipeline: result.data });
}
