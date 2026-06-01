export const AUDIT_EVIDENCE_ENTITY_TYPES = ["company", "investor", "spv"] as const;
export type AuditEvidenceEntityType = (typeof AUDIT_EVIDENCE_ENTITY_TYPES)[number];

export const AUDIT_TIMELINE_SOURCES = [
  "audit_log",
  "compliance_event",
  "operational_activity",
  "automation_run",
  "orchestration_run",
  "scheduled_digest",
  "import_batch",
  "collaboration_comment",
  "report_audit",
] as const;

export type AuditTimelineSource = (typeof AUDIT_TIMELINE_SOURCES)[number];

export type AuditComplianceFilters = {
  companyId?: string;
  investorId?: string;
  investorProfileId?: string;
  spvId?: string;
  userId?: string;
  eventType?: string;
  severity?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sourceModule?: string;
  limit?: number;
};

export type AuditTimelineEntry = {
  id: string;
  source: AuditTimelineSource;
  eventType: string;
  title: string;
  description: string | null;
  severity: string;
  status: string | null;
  entityType: string | null;
  entityId: string | null;
  companyId: string | null;
  investorId: string | null;
  spvId: string | null;
  actorUserId: string | null;
  sourceModule: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AuditRiskSummary = {
  openCriticalCompliance: number;
  openHighCompliance: number;
  overdueActions: number;
  escalatedWorkflows: number;
  failedAutomationRunsToday: number;
  failedOrchestrationRunsToday: number;
  failedImportsToday: number;
  unresolvedSpvBlockers: number;
  companiesWithRepeatedFlags: number;
};

export type ComplianceEvidencePack = {
  entityType: AuditEvidenceEntityType;
  entityId: string;
  generatedAt: string;
  summary: {
    timelineEventCount: number;
    openComplianceCount: number;
    collaborationCommentCount: number;
    actionCount: number;
    automationRunCount: number;
    reportExportCount: number;
    importBatchCount: number;
  };
  timeline: AuditTimelineEntry[];
  complianceEvents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    eventType: string;
    createdAt: string;
    reviewedAt: string | null;
  }>;
  actionHistory: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    category: string;
    updatedAt: string;
  }>;
  automationHistory: Array<{
    id: string;
    status: string;
    triggerType: string | null;
    startedAt: string;
    failuresCount: number;
    dryRun: boolean;
  }>;
  orchestrationHistory: Array<{
    id: string;
    status: string;
    startedAt: string;
    failuresCount: number;
    triggerSource: string;
  }>;
  reportAudits: Array<{
    action: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
  importAudits: Array<{
    id: string;
    importType: string;
    status: string;
    fileName: string;
    createdAt: string;
    failedRows: number;
  }>;
  collaborationSummary: {
    commentCount: number;
    threadCount: number;
    byVisibility: Record<string, number>;
  };
  operationalSummaries: Array<{ category: string; count: number }>;
};

export type AuditExportPayload = {
  exportedAt: string;
  filters: AuditComplianceFilters;
  riskSummary: AuditRiskSummary;
  timeline: AuditTimelineEntry[];
  evidencePack?: ComplianceEvidencePack | null;
};
