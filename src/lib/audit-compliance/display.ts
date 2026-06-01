import type { AuditTimelineEntry, AuditTimelineSource } from "@/lib/audit-compliance/types";

export function auditSourceLabel(source: AuditTimelineSource): string {
  const labels: Record<AuditTimelineSource, string> = {
    audit_log: "Audit log",
    compliance_event: "Compliance",
    operational_activity: "Operational",
    automation_run: "Automation",
    orchestration_run: "Orchestration",
    scheduled_digest: "Scheduled digest",
    import_batch: "Import",
    collaboration_comment: "Collaboration",
    report_audit: "Report",
  };
  return labels[source] ?? source;
}

export function formatAuditTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function severityBadgeStatus(
  severity: string,
): "neutral" | "info" | "success" | "warning" | "danger" | "pending" {
  switch (severity) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "pending";
    case "low":
      return "info";
    default:
      return "neutral";
  }
}

export function timelineEntryToCsvRow(entry: AuditTimelineEntry): Record<string, unknown> {
  return {
    id: entry.id,
    source: entry.source,
    event_type: entry.eventType,
    title: entry.title,
    severity: entry.severity,
    status: entry.status ?? "",
    entity_type: entry.entityType ?? "",
    entity_id: entry.entityId ?? "",
    company_id: entry.companyId ?? "",
    source_module: entry.sourceModule,
    created_at: entry.createdAt,
  };
}
