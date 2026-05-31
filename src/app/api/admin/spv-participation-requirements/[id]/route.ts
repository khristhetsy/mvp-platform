import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { updateParticipationRequirement } from "@/lib/spv/participation-requirements";
import { adminSpvParticipationRequirementUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = adminSpvParticipationRequirementUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid requirement update." }, { status: 400 });
  }

  const result = await updateParticipationRequirement(auth.supabase, {
    requirementId: id,
    status: parsed.data.status,
    reviewNotes: parsed.data.reviewNotes,
    actorId: auth.profile.id,
  });

  if (result.error || !result.data) {
    const message =
      result.error instanceof Error ? result.error.message : "Unable to update requirement.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.spv_participation_requirement_updated",
    entityType: "spv_participation_requirement",
    entityId: id,
    metadata: { status: parsed.data.status, participationId: result.data.spv_participation_id },
  });

  return NextResponse.json({ requirement: result.data });
}
