import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { updateSpvChecklistItem } from "@/lib/spv/checklist";
import { adminSpvChecklistItemUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = adminSpvChecklistItemUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checklist update." }, { status: 400 });
  }

  const result = await updateSpvChecklistItem(auth.supabase, {
    itemId: id,
    status: parsed.data.status,
    actorId: auth.profile.id,
  });

  if (result.error || !result.data) {
    const message =
      result.error instanceof Error ? result.error.message : "Unable to update checklist item.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.spv_checklist_item_updated",
    entityType: "spv_checklist_item",
    entityId: id,
    metadata: { status: parsed.data.status, spvOpportunityId: result.data.spv_opportunity_id },
  });

  return NextResponse.json({ item: result.data });
}
