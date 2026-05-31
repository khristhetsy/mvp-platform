import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { writeAuditLog } from "@/lib/data/audit";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { recordOperationalError } from "@/lib/monitoring/operational-events";
import { syncSpvClosingReadiness } from "@/lib/spv/closing-reviews";
import { refreshSpvOperationalReadiness } from "@/lib/spv/sync-readiness";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const rateLimited = await enforceRateLimit({
    bucket: "admin_spv_sync",
    subjectId: auth.profile.id,
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) {
    return rateLimited;
  }

  const { id: spvOpportunityId } = await context.params;

  try {
    const readiness = await refreshSpvOperationalReadiness(auth.supabase, spvOpportunityId, {
      actorId: auth.profile.id,
    });

    if (readiness.error) {
      throw readiness.error;
    }

    const closing = await syncSpvClosingReadiness(auth.supabase, spvOpportunityId, {
      actorId: auth.profile.id,
      persistSnapshot: true,
    });

    if (closing.error) {
      throw closing.error;
    }

    await writeAuditLog(auth.supabase, {
      userId: auth.profile.id,
      action: "admin.spv_readiness_synced",
      entityType: "spv_opportunity",
      entityId: spvOpportunityId,
      metadata: {
        operationalReadiness: readiness.readiness,
        closingReadinessPct: closing.summary?.readinessPct,
      },
    });

    emitOperationalEvent(auth.supabase, {
      eventType: "spv_readiness_updated",
      eventCategory: "spv",
      entityType: "spv_opportunity",
      entityId: spvOpportunityId,
      actorUserId: auth.profile.id,
      actorRole: auth.profile.role,
      spvId: spvOpportunityId,
      title: "SPV readiness updated",
      sourceModule: "admin_spv",
      visibility: "admin_only",
      dedupeKey: `spv_readiness:${spvOpportunityId}:${readiness.readiness}`,
      metadata: {
        operationalReadiness: readiness.readiness,
        closingReadinessPct: closing.summary?.readinessPct,
      },
    });

    return NextResponse.json({
      operationalReadiness: readiness.readiness,
      closing: closing.summary,
      investorClosingStatus: closing.investorClosingStatus,
    });
  } catch (error) {
    recordOperationalError("spv.readiness_sync_failed", error, { spvOpportunityId });
    const message = error instanceof Error ? error.message : "Unable to sync SPV readiness.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
