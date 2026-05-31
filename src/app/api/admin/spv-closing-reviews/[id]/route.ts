import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { updateSpvClosingReview } from "@/lib/spv/closing-reviews";
import { adminSpvClosingReviewUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = adminSpvClosingReviewUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid closing review update." }, { status: 400 });
  }

  const result = await updateSpvClosingReview(auth.supabase, {
    reviewId: id,
    status: parsed.data.status,
    internalNotes: parsed.data.internalNotes,
    closingTargetOverride: parsed.data.closingTargetOverride,
    actorId: auth.profile.id,
  });

  if (result.error || !result.data) {
    const message =
      result.error instanceof Error ? result.error.message : "Unable to update closing review.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.spv_closing_review_updated",
    entityType: "spv_closing_review",
    entityId: id,
    metadata: { status: parsed.data.status, spvOpportunityId: result.data.spv_opportunity_id },
  });

  return NextResponse.json({ review: result.data });
}
