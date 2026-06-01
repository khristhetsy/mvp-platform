import { timelineEntryToCsvRow } from "@/lib/audit-compliance/display";
import type {
  AuditComplianceFilters,
  AuditExportPayload,
  AuditRiskSummary,
  AuditTimelineEntry,
  ComplianceEvidencePack,
} from "@/lib/audit-compliance/types";
import { rowsToCsv, reportFilename } from "@/lib/reports/export";

export function buildAuditExportPayload(input: {
  filters: AuditComplianceFilters;
  riskSummary: AuditRiskSummary;
  timeline: AuditTimelineEntry[];
  evidencePack?: ComplianceEvidencePack | null;
}): AuditExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    filters: input.filters,
    riskSummary: input.riskSummary,
    timeline: input.timeline,
    evidencePack: input.evidencePack ?? null,
  };
}

export function auditExportToCsv(payload: AuditExportPayload): string {
  const timelineRows = payload.timeline.map(timelineEntryToCsvRow);
  const riskRows = [
    {
      metric: "open_critical_compliance",
      value: payload.riskSummary.openCriticalCompliance,
    },
    {
      metric: "open_high_compliance",
      value: payload.riskSummary.openHighCompliance,
    },
    { metric: "overdue_actions", value: payload.riskSummary.overdueActions },
    { metric: "escalated_workflows", value: payload.riskSummary.escalatedWorkflows },
    {
      metric: "failed_automation_today",
      value: payload.riskSummary.failedAutomationRunsToday,
    },
    {
      metric: "failed_orchestration_today",
      value: payload.riskSummary.failedOrchestrationRunsToday,
    },
    { metric: "failed_imports_today", value: payload.riskSummary.failedImportsToday },
    { metric: "unresolved_spv_blockers", value: payload.riskSummary.unresolvedSpvBlockers },
    {
      metric: "companies_repeated_flags",
      value: payload.riskSummary.companiesWithRepeatedFlags,
    },
  ];

  const sections = [
    "# Risk summary",
    rowsToCsv(riskRows),
    "",
    "# Timeline",
    rowsToCsv(timelineRows),
  ];

  if (payload.evidencePack) {
    sections.push(
      "",
      "# Evidence summary",
      rowsToCsv([
        {
          entity_type: payload.evidencePack.entityType,
          entity_id: payload.evidencePack.entityId,
          timeline_events: payload.evidencePack.summary.timelineEventCount,
          open_compliance: payload.evidencePack.summary.openComplianceCount,
          comments: payload.evidencePack.summary.collaborationCommentCount,
        },
      ]),
    );
  }

  return sections.join("\n");
}

export function auditExportFilename(format: "json" | "csv", entityType?: string) {
  const base = entityType ? `audit-${entityType}` : "audit-compliance";
  return reportFilename(base, format);
}
