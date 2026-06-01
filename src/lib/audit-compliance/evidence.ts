import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuditComplianceTimeline } from "@/lib/audit-compliance/audit-trail";
import type {
  AuditComplianceFilters,
  AuditEvidenceEntityType,
  ComplianceEvidencePack,
} from "@/lib/audit-compliance/types";
import { sanitizeOperationalMetadata } from "@/lib/operational-activity/sanitize";
import type { Database } from "@/lib/supabase/types";

async function loadOperationalCategories(
  supabase: SupabaseClient<Database>,
  entityType: AuditEvidenceEntityType,
  entityId: string,
) {
  let query = supabase.from("operational_activity_events").select("event_category").limit(100);

  if (entityType === "company") {
    query = query.eq("company_id", entityId);
  } else if (entityType === "spv") {
    query = query.eq("spv_id", entityId);
  } else {
    const { data: inv } = await supabase
      .from("investor_profiles")
      .select("profile_id")
      .eq("id", entityId)
      .maybeSingle();
    if (inv?.profile_id) query = query.eq("investor_id", inv.profile_id);
    else return { data: [] };
  }

  return query;
}

function entityFilters(
  entityType: AuditEvidenceEntityType,
  entityId: string,
): AuditComplianceFilters {
  if (entityType === "company") return { companyId: entityId, limit: 80 };
  if (entityType === "investor") return { investorProfileId: entityId, limit: 80 };
  return { spvId: entityId, limit: 80 };
}

export async function buildComplianceEvidencePack(
  supabase: SupabaseClient<Database>,
  entityType: AuditEvidenceEntityType,
  entityId: string,
): Promise<ComplianceEvidencePack> {
  const filters = entityFilters(entityType, entityId);
  const timeline = await getAuditComplianceTimeline(supabase, filters);

  let complianceQuery = supabase
    .from("compliance_events")
    .select("id, title, severity, status, event_type, created_at, reviewed_at")
    .order("created_at", { ascending: false })
    .limit(30);

  let actionQuery = supabase
    .from("next_best_actions")
    .select("id, title, status, priority, category, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);

  let threadQuery = supabase.from("collaboration_threads").select("id, entity_type, entity_id");

  if (entityType === "company") {
    complianceQuery = complianceQuery.eq("company_id", entityId);
    actionQuery = actionQuery.eq("company_id", entityId);
    threadQuery = threadQuery.eq("company_id", entityId);
  } else if (entityType === "investor") {
    complianceQuery = complianceQuery.eq("investor_id", entityId);
    actionQuery = actionQuery.eq("investor_id", entityId);
    threadQuery = threadQuery.eq("investor_profile_id", entityId);
  } else {
    actionQuery = actionQuery.eq("spv_id", entityId);
    threadQuery = threadQuery.eq("spv_id", entityId);
  }

  const [
    complianceEvents,
    actions,
    threads,
    automationRuns,
    orchestrationRuns,
    reportAudits,
    importBatches,
    operationalCategories,
  ] = await Promise.all([
    complianceQuery,
    actionQuery,
    threadQuery,
    supabase
      .from("automation_runs")
      .select("id, status, trigger_type, started_at, failures_count, dry_run, entity_type, entity_id")
      .order("started_at", { ascending: false })
      .limit(15),
    supabase
      .from("orchestration_runs")
      .select("id, status, started_at, failures_count, trigger_source")
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_logs")
      .select("action, created_at, metadata, entity_type, entity_id")
      .eq("action", "admin.report_generated")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("import_batches")
      .select("id, import_type, status, file_name, created_at, failed_rows")
      .order("created_at", { ascending: false })
      .limit(10),
    loadOperationalCategories(supabase, entityType, entityId),
  ]);

  const threadIds = (threads.data ?? []).map((t) => t.id);
  let commentCount = 0;
  const byVisibility: Record<string, number> = {};

  if (threadIds.length > 0) {
    const { data: comments } = await supabase
      .from("collaboration_comments")
      .select("visibility")
      .in("thread_id", threadIds);
    commentCount = comments?.length ?? 0;
    for (const c of comments ?? []) {
      byVisibility[c.visibility] = (byVisibility[c.visibility] ?? 0) + 1;
    }
  }

  const categoryCounts = new Map<string, number>();
  for (const row of operationalCategories.data ?? []) {
    categoryCounts.set(row.event_category, (categoryCounts.get(row.event_category) ?? 0) + 1);
  }

  const filteredAutomation = (automationRuns.data ?? []).filter((row) => {
    if (entityType === "company") return row.entity_type === "company" && row.entity_id === entityId;
    if (entityType === "spv") return row.entity_type === "spv" && row.entity_id === entityId;
    return true;
  });

  const filteredReports = (reportAudits.data ?? []).filter((row) => {
    const meta = sanitizeOperationalMetadata((row.metadata ?? {}) as Record<string, unknown>);
    if (entityType === "company" && meta.company_id === entityId) return true;
    return entityType !== "company";
  });

  const openCompliance = (complianceEvents.data ?? []).filter((e) =>
    ["open", "under_review"].includes(e.status),
  ).length;

  return {
    entityType,
    entityId,
    generatedAt: new Date().toISOString(),
    summary: {
      timelineEventCount: timeline.length,
      openComplianceCount: openCompliance,
      collaborationCommentCount: commentCount,
      actionCount: actions.data?.length ?? 0,
      automationRunCount: filteredAutomation.length,
      reportExportCount: filteredReports.length,
      importBatchCount: importBatches.data?.length ?? 0,
    },
    timeline,
    complianceEvents: (complianceEvents.data ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      severity: e.severity,
      status: e.status,
      eventType: e.event_type,
      createdAt: e.created_at,
      reviewedAt: e.reviewed_at,
    })),
    actionHistory: (actions.data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      priority: a.priority,
      category: a.category,
      updatedAt: a.updated_at,
    })),
    automationHistory: filteredAutomation.map((r) => ({
      id: r.id,
      status: r.status,
      triggerType: r.trigger_type,
      startedAt: r.started_at,
      failuresCount: r.failures_count,
      dryRun: r.dry_run,
    })),
    orchestrationHistory: (orchestrationRuns.data ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      startedAt: r.started_at,
      failuresCount: r.failures_count,
      triggerSource: r.trigger_source,
    })),
    reportAudits: filteredReports.map((r) => ({
      action: String(r.action ?? ""),
      createdAt: String(r.created_at ?? ""),
      metadata: sanitizeOperationalMetadata((r.metadata ?? {}) as Record<string, unknown>),
    })),
    importAudits: (importBatches.data ?? []).map((i) => ({
      id: i.id,
      importType: i.import_type,
      status: i.status,
      fileName: i.file_name,
      createdAt: i.created_at,
      failedRows: i.failed_rows,
    })),
    collaborationSummary: {
      commentCount,
      threadCount: threadIds.length,
      byVisibility,
    },
    operationalSummaries: [...categoryCounts.entries()].map(([category, count]) => ({
      category,
      count,
    })),
  };
}
