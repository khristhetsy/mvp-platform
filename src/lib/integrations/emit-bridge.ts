import { emitOutboundIntegrationEvent } from "@/lib/integrations/delivery";

/** Fire-and-forget outbound integration emit — never throws. */
export function bridgeIntegrationEvent(
  params: Parameters<typeof emitOutboundIntegrationEvent>[0],
): void {
  void emitOutboundIntegrationEvent(params).catch((error) => {
    console.error("[capitalos] integration emit failed", {
      event_type: params.event_type,
      error: error instanceof Error ? error.message : "unknown",
    });
  });
}

export function bridgeOrchestrationFailed(runId: string | null, failuresCount: number): void {
  if (failuresCount <= 0) return;
  bridgeIntegrationEvent({
    event_type: "orchestration_failed",
    severity: "high",
    entity_type: "orchestration_run",
    entity_id: runId,
    metadata: { failures_count: failuresCount },
  });
}

export function bridgeAutomationFailed(runId: string | null, failures: number): void {
  if (failures <= 0) return;
  bridgeIntegrationEvent({
    event_type: "automation_failed",
    severity: "high",
    entity_type: "automation_run",
    entity_id: runId,
    metadata: { failures_count: failures },
  });
}

export function bridgeDigestGenerated(count: number): void {
  if (count <= 0) return;
  bridgeIntegrationEvent({
    event_type: "digest_generated",
    severity: "info",
    metadata: { digests_generated: count },
  });
}

export function bridgeAuditExportGenerated(actorId: string, format: string): void {
  bridgeIntegrationEvent({
    event_type: "audit_export_generated",
    severity: "info",
    entity_type: "profile",
    entity_id: actorId,
    metadata: { format },
  });
}

export function bridgeCollaborationComment(
  entityType: string,
  entityId: string,
  companyId: string | null,
): void {
  bridgeIntegrationEvent({
    event_type: "collaboration_comment_created",
    severity: "info",
    entity_type: entityType,
    entity_id: entityId,
    company_id: companyId,
    metadata: { comment_metadata_only: true },
  });
}

export function bridgeWorkflowOverdue(count: number): void {
  if (count <= 0) return;
  bridgeIntegrationEvent({
    event_type: "workflow_overdue",
    severity: "critical",
    metadata: { overdue_count: count },
  });
}

export function bridgeWorkflowEscalated(count: number): void {
  if (count <= 0) return;
  bridgeIntegrationEvent({
    event_type: "workflow_escalated",
    severity: "high",
    metadata: { escalated_count: count },
  });
}

export function bridgeComplianceCritical(
  entityType: string,
  entityId: string,
  companyId?: string | null,
): void {
  bridgeIntegrationEvent({
    event_type: "compliance_critical_escalation",
    severity: "critical",
    entity_type: entityType,
    entity_id: entityId,
    company_id: companyId ?? null,
  });
}

export function bridgeImportFailure(source: string): void {
  bridgeIntegrationEvent({
    event_type: "import_failure",
    severity: "high",
    metadata: { source },
  });
}

export function bridgeWorkflowBlocked(
  entityType: string,
  entityId: string,
  blockerCount: number,
): void {
  if (blockerCount <= 0) return;
  bridgeIntegrationEvent({
    event_type: "workflow_blocked",
    severity: "medium",
    entity_type: entityType,
    entity_id: entityId,
    metadata: { unresolved_dependencies: blockerCount },
  });
}
