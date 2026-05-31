import { NextResponse } from "next/server";
import { requireInvestorApprovedApi } from "@/lib/api/investor";
import { writeAuditLog } from "@/lib/data/audit";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { uploadInvestorSpvRequirementDocument } from "@/lib/spv/participation-requirements";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireInvestorApprovedApi();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const result = await uploadInvestorSpvRequirementDocument(auth.supabase, admin, {
    investorId: auth.investorId,
    requirementId: id,
    file,
  });

  if (result.error || !result.data) {
    const message = result.error instanceof Error ? result.error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog(admin, {
    userId: auth.investorId,
    action: "investor.spv_requirement_document_uploaded",
    entityType: "spv_participation_requirement",
    entityId: id,
    metadata: { documentId: result.document?.id },
  });

  return NextResponse.json({ requirement: result.data, document: result.document });
}
