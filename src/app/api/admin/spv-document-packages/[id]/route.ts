import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { updateSpvDocumentPackage } from "@/lib/spv/document-packages";
import { adminSpvDocumentPackageUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = adminSpvDocumentPackageUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid package update." }, { status: 400 });
  }

  const result = await updateSpvDocumentPackage(auth.supabase, {
    packageId: id,
    status: parsed.data.status,
    notes: parsed.data.notes,
    actorId: auth.profile.id,
  });

  if (result.error || !result.data) {
    const message = result.error instanceof Error ? result.error.message : "Unable to update package.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.spv_document_package_updated",
    entityType: "spv_document_package",
    entityId: id,
    metadata: { status: parsed.data.status, spvOpportunityId: result.data.spv_opportunity_id },
  });

  return NextResponse.json({ package: result.data });
}
