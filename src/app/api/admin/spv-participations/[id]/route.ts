import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { updateSpvParticipationStatus } from "@/lib/spv/participation-requirements";
import { adminSpvParticipationUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = adminSpvParticipationUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid participation update." }, { status: 400 });
  }

  const result = await updateSpvParticipationStatus(auth.supabase, {
    spvParticipationId: id,
    status: parsed.data.status,
    actorId: auth.profile.id,
  });

  if (result.error || !result.data) {
    const message =
      result.error instanceof Error ? result.error.message : "Unable to update participation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.spv_participation_status",
    entityType: "spv_participation",
    entityId: id,
    metadata: { status: parsed.data.status },
  });

  return NextResponse.json({ participation: result.data });
}
