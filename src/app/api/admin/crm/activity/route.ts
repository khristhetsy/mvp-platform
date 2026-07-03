import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { deleteInvestorCrmActivity, clearAllInvestorCrmActivity } from "@/lib/data/investor-crm";

export const dynamic = "force-dynamic";

/**
 * Delete investor CRM activity (admin only, audit-logged).
 *   DELETE /api/admin/crm/activity?id=<uuid>   → remove one row
 *   DELETE /api/admin/crm/activity?all=1        → clear the whole timeline
 */
export async function DELETE(req: NextRequest): Promise<Response> {
  // Admins only — analysts have read-only visibility into the timeline.
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const all = searchParams.get("all") === "1";

  if (!id && !all) {
    return NextResponse.json({ error: "Provide ?id=<uuid> or ?all=1." }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    if (id) {
      await deleteInvestorCrmActivity(supabase, id);
      await writeAuditLog(supabase, {
        userId: profile.id,
        action: "investor_crm_activity_deleted",
        entityType: "investor_activity",
        entityId: id,
      });
      return NextResponse.json({ ok: true, deleted: 1 });
    }
    const deleted = await clearAllInvestorCrmActivity(supabase);
    await writeAuditLog(supabase, {
      userId: profile.id,
      action: "investor_crm_activity_cleared",
      entityType: "investor_activity",
      metadata: { deleted },
    });
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to delete activity." }, { status: 500 });
  }
}
