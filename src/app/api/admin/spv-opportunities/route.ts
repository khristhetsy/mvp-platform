import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { createSpvOpportunity, listAdminSpvOpportunities } from "@/lib/spv/spv-workflow";
import { adminSpvOpportunityCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const result = await listAdminSpvOpportunities(auth.supabase);
  if (result.error) {
    return NextResponse.json({ error: "Unable to load SPV opportunities." }, { status: 400 });
  }

  return NextResponse.json({ opportunities: result.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = adminSpvOpportunityCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid SPV opportunity payload." }, { status: 400 });
  }

  const result = await createSpvOpportunity(auth.supabase, {
    companyId: parsed.data.companyId,
    createdBy: auth.profile.id,
    name: parsed.data.name,
    targetAmount: parsed.data.targetAmount,
    minimumCommitment: parsed.data.minimumCommitment,
    description: parsed.data.description,
    termsSummary: parsed.data.termsSummary,
    status: parsed.data.status,
  });

  if (result.error || !result.data) {
    return NextResponse.json({ error: "Unable to create SPV opportunity." }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.spv_opportunity_created",
    entityType: "spv_opportunity",
    entityId: result.data.id,
    metadata: { companyId: parsed.data.companyId, status: result.data.status },
  });

  return NextResponse.json({ opportunity: result.data });
}
