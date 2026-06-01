import { writeAuditLog } from "@/lib/data/audit";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import type { SpvExecutionReadinessSummary } from "@/lib/document-execution/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/supabase/types";

export async function logDocumentExecutionReadinessChecked(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  summary: SpvExecutionReadinessSummary,
): Promise<void> {
  await writeAuditLog(supabase, {
    userId: profile.id,
    action: "document_execution_readiness_checked",
    entityType: "spv_opportunity",
    entityId: summary.spvId,
    metadata: {
      spv_id: summary.spvId,
      execution_readiness_pct: summary.executionReadinessPct,
      signer_readiness_pct: summary.signerReadinessPct,
      blocked_package_count: summary.blockedPackages.length,
      docusign_status: summary.docusignStatus,
    },
  });

  emitOperationalEvent(supabase, {
    eventType: "document_execution_readiness_checked",
    eventCategory: "spv",
    entityType: "spv_opportunity",
    entityId: summary.spvId,
    actorUserId: profile.id,
    actorRole: profile.role,
    companyId: summary.companyId,
    spvId: summary.spvId,
    severity: summary.blockedPackages.length > 0 ? "medium" : "info",
    title: "Document execution readiness checked",
    description: `${summary.executionReadinessPct}% execution · ${summary.signerReadinessPct}% signers. No e-sign sent.`,
    metadata: {
      execution_readiness_pct: summary.executionReadinessPct,
      signer_readiness_pct: summary.signerReadinessPct,
    },
    sourceModule: "document_execution",
    visibility: "admin_only",
  });

  if (summary.blockedPackages.length > 0) {
    await writeAuditLog(supabase, {
      userId: profile.id,
      action: "signer_readiness_blocked",
      entityType: "spv_opportunity",
      entityId: summary.spvId,
      metadata: {
        blocked_packages: summary.blockedPackages.map((p) => p.kind),
        next_required_step: summary.nextRequiredStep,
      },
    });
  }

  if (summary.readyForFutureEsign) {
    await writeAuditLog(supabase, {
      userId: profile.id,
      action: "package_ready_for_execution",
      entityType: "spv_opportunity",
      entityId: summary.spvId,
      metadata: {
        execution_readiness_pct: summary.executionReadinessPct,
        note: "Ready for future DocuSign — no envelopes sent in Phase 1",
      },
    });

    emitOperationalEvent(supabase, {
      eventType: "package_ready_for_execution",
      eventCategory: "spv",
      entityType: "spv_opportunity",
      entityId: summary.spvId,
      actorUserId: profile.id,
      actorRole: profile.role,
      spvId: summary.spvId,
      companyId: summary.companyId,
      severity: "info",
      title: "Packages ready for future execution",
      description: "Operational readiness complete. DocuSign connector not active.",
      sourceModule: "document_execution",
      visibility: "admin_only",
    });
  }
}
