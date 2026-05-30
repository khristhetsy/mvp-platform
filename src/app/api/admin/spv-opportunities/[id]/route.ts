import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { updateSpvOpportunityStatus } from "@/lib/spv/spv-workflow";
import { adminSpvOpportunityUpdateSchema } from "@/lib/validation";
import type { Database } from "@/lib/supabase/types";

type SpvOpportunityUpdate = Database["public"]["Tables"]["spv_opportunities"]["Update"];

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = adminSpvOpportunityUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid SPV update." }, { status: 400 });
  }

  if (parsed.data.status) {
    const result = await updateSpvOpportunityStatus(auth.supabase, {
      spvOpportunityId: id,
      status: parsed.data.status,
      actorId: auth.profile.id,
    });

    if (result.error || !result.data) {
      return NextResponse.json({ error: "Unable to update SPV status." }, { status: 400 });
    }

    await writeAuditLog(auth.supabase, {
      userId: auth.profile.id,
      action: "admin.spv_opportunity_status",
      entityType: "spv_opportunity",
      entityId: id,
      metadata: { status: parsed.data.status },
    });

    return NextResponse.json({ opportunity: result.data });
  }

  const patch: SpvOpportunityUpdate = { updated_at: new Date().toISOString() };
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.targetAmount != null) patch.target_amount = parsed.data.targetAmount;
  if (parsed.data.minimumCommitment != null) patch.minimum_commitment = parsed.data.minimumCommitment;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.termsSummary !== undefined) patch.terms_summary = parsed.data.termsSummary;

  const { data, error } = await auth.supabase
    .from("spv_opportunities")
    .update(patch)
    .eq("id", id)
    .select("*, companies(company_name, slug)")
    .single();

  if (error) {
    return NextResponse.json({ error: "Unable to update SPV opportunity." }, { status: 400 });
  }

  return NextResponse.json({ opportunity: data });
}
