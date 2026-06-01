import type { SupabaseClient } from "@supabase/supabase-js";
import { applyAuditTimelineFilters } from "@/lib/audit-compliance/filters";
import type { AuditComplianceFilters, AuditTimelineEntry } from "@/lib/audit-compliance/types";
import { sanitizeOperationalMetadata } from "@/lib/operational-activity/sanitize";
import type { Database } from "@/lib/supabase/types";

const FETCH_PER_SOURCE = 40;

function safeMeta(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  return sanitizeOperationalMetadata(raw as Record<string, unknown>);
}

function applyQueryScope<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  filters: AuditComplianceFilters,
  cols: { company?: string; investor?: string; spv?: string; user?: string },
): T {
  let q = query;
  if (filters.companyId && cols.company) q = q.eq(cols.company, filters.companyId);
  if (filters.investorId && cols.investor) q = q.eq(cols.investor, filters.investorId);
  if (filters.spvId && cols.spv) q = q.eq(cols.spv, filters.spvId);
  if (filters.userId && cols.user) q = q.eq(cols.user, filters.userId);
  return q;
}

async function loadAuditLogs(
  supabase: SupabaseClient<Database>,
  filters: AuditComplianceFilters,
): Promise<AuditTimelineEntry[]> {
  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, user_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(FETCH_PER_SOURCE);

  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setUTCHours(23, 59, 59, 999);
    query = query.lte("created_at", end.toISOString());
  }

  const { data } = await query;
  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      action: string;
      entity_type: string;
      entity_id: string | null;
      user_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    };
    const meta = safeMeta(r.metadata);
    const action = String(r.action ?? "audit");
    return {
      id: `audit_log:${r.id}`,
      source: "audit_log" as const,
      eventType: action,
      title: action.replaceAll(".", " · "),
      description: null,
      severity: String(meta.severity ?? "info"),
      status: String(meta.status ?? ""),
      entityType: r.entity_type ?? null,
      entityId: r.entity_id,
      companyId: typeof meta.company_id === "string" ? meta.company_id : null,
      investorId: typeof meta.investor_id === "string" ? meta.investor_id : null,
      spvId: typeof meta.spv_id === "string" ? meta.spv_id : null,
      actorUserId: r.user_id,
      sourceModule: String(meta.source_module ?? "audit"),
      createdAt: String(r.created_at ?? new Date().toISOString()),
      metadata: meta,
    };
  });
}

async function loadComplianceEvents(
  supabase: SupabaseClient<Database>,
  filters: AuditComplianceFilters,
): Promise<AuditTimelineEntry[]> {
  let query = supabase
    .from("compliance_events")
    .select("id, event_type, title, severity, status, company_id, investor_id, founder_id, created_at, reviewed_at")
    .order("created_at", { ascending: false })
    .limit(FETCH_PER_SOURCE);

  query = applyQueryScope(query, filters, { company: "company_id", investor: "investor_id" });
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: `compliance_event:${row.id}`,
    source: "compliance_event",
    eventType: row.event_type,
    title: row.title,
    description: null,
    severity: row.severity,
    status: row.status,
    entityType: "compliance_event",
    entityId: row.id,
    companyId: row.company_id,
    investorId: row.investor_id,
    spvId: null,
    actorUserId: row.founder_id,
    sourceModule: "compliance",
    createdAt: row.created_at,
    metadata: { reviewed_at: row.reviewed_at },
  }));
}

async function loadOperationalActivity(
  supabase: SupabaseClient<Database>,
  filters: AuditComplianceFilters,
): Promise<AuditTimelineEntry[]> {
  let query = supabase
    .from("operational_activity_events")
    .select(
      "id, event_type, title, severity, event_category, entity_type, entity_id, company_id, investor_id, spv_id, actor_user_id, source_module, created_at, metadata",
    )
    .order("created_at", { ascending: false })
    .limit(FETCH_PER_SOURCE);

  query = applyQueryScope(query, filters, {
    company: "company_id",
    investor: "investor_id",
    spv: "spv_id",
  });
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: `operational_activity:${row.id}`,
    source: "operational_activity",
    eventType: row.event_type,
    title: row.title,
    description: null,
    severity: row.severity,
    status: row.event_category,
    entityType: row.entity_type,
    entityId: row.entity_id,
    companyId: row.company_id,
    investorId: row.investor_id,
    spvId: row.spv_id,
    actorUserId: row.actor_user_id,
    sourceModule: row.source_module,
    createdAt: row.created_at,
    metadata: safeMeta(row.metadata),
  }));
}

async function loadAutomationRuns(
  supabase: SupabaseClient<Database>,
  filters: AuditComplianceFilters,
): Promise<AuditTimelineEntry[]> {
  let query = supabase
    .from("automation_runs")
    .select("id, trigger_type, status, entity_type, entity_id, failures_count, dry_run, started_at, metadata")
    .order("started_at", { ascending: false })
    .limit(FETCH_PER_SOURCE);

  if (filters.dateFrom) query = query.gte("started_at", filters.dateFrom);

  const { data } = await query;
  return (data ?? [])
    .filter((row) => {
      if (filters.companyId || filters.spvId) {
        const meta = safeMeta(row.metadata);
        if (filters.companyId && meta.company_id !== filters.companyId) return false;
      }
      return true;
    })
    .map((row) => ({
      id: `automation_run:${row.id}`,
      source: "automation_run",
      eventType: row.trigger_type ?? "automation",
      title: `Automation run (${row.status})`,
      description: null,
      severity: row.failures_count > 0 ? "high" : "info",
      status: row.status,
      entityType: row.entity_type,
      entityId: row.entity_id,
      companyId: null,
      investorId: null,
      spvId: null,
      actorUserId: null,
      sourceModule: "workflow_automation",
      createdAt: row.started_at,
      metadata: safeMeta(row.metadata),
    }));
}

async function loadOrchestrationRuns(
  supabase: SupabaseClient<Database>,
  filters: AuditComplianceFilters,
): Promise<AuditTimelineEntry[]> {
  let query = supabase
    .from("orchestration_runs")
    .select("id, status, trigger_source, failures_count, started_at, metadata")
    .order("started_at", { ascending: false })
    .limit(FETCH_PER_SOURCE);

  if (filters.dateFrom) query = query.gte("started_at", filters.dateFrom);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: `orchestration_run:${row.id}`,
    source: "orchestration_run",
    eventType: `orchestration_${row.trigger_source}`,
    title: `Orchestration run (${row.status})`,
    description: null,
    severity: row.failures_count > 0 ? "high" : "info",
    status: row.status,
    entityType: "orchestration",
    entityId: row.id,
    companyId: null,
    investorId: null,
    spvId: null,
    actorUserId: null,
    sourceModule: "orchestration",
    createdAt: row.started_at,
    metadata: safeMeta(row.metadata),
  }));
}

async function loadDigestRuns(
  supabase: SupabaseClient<Database>,
  filters: AuditComplianceFilters,
): Promise<AuditTimelineEntry[]> {
  let query = supabase
    .from("scheduled_digest_runs")
    .select("id, digest_type, severity, delivery_status, generated_at, item_count, metadata")
    .order("generated_at", { ascending: false })
    .limit(20);

  if (filters.dateFrom) query = query.gte("generated_at", filters.dateFrom);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: `scheduled_digest:${row.id}`,
    source: "scheduled_digest",
    eventType: row.digest_type,
    title: `Digest run (${row.delivery_status})`,
    description: null,
    severity: row.severity,
    status: row.delivery_status,
    entityType: "digest",
    entityId: row.id,
    companyId: null,
    investorId: null,
    spvId: null,
    actorUserId: null,
    sourceModule: "scheduled_digest",
    createdAt: row.generated_at,
    metadata: safeMeta({ item_count: row.item_count, ...(row.metadata as object) }),
  }));
}

async function loadImportBatches(
  supabase: SupabaseClient<Database>,
  filters: AuditComplianceFilters,
): Promise<AuditTimelineEntry[]> {
  let query = supabase
    .from("import_batches")
    .select("id, import_type, status, file_name, failed_rows, created_at, uploaded_by")
    .order("created_at", { ascending: false })
    .limit(20);

  if (filters.userId) query = query.eq("uploaded_by", filters.userId);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: `import_batch:${row.id}`,
    source: "import_batch",
    eventType: `import_${row.import_type}`,
    title: `Import ${row.import_type} (${row.status})`,
    description: null,
    severity: row.failed_rows > 0 ? "high" : "info",
    status: row.status,
    entityType: "import_batch",
    entityId: row.id,
    companyId: null,
    investorId: null,
    spvId: null,
    actorUserId: row.uploaded_by,
    sourceModule: "imports",
    createdAt: row.created_at,
    metadata: { file_name: row.file_name, failed_rows: row.failed_rows },
  }));
}

async function loadCollaborationMeta(
  supabase: SupabaseClient<Database>,
  filters: AuditComplianceFilters,
): Promise<AuditTimelineEntry[]> {
  let threadQuery = supabase.from("collaboration_threads").select("id, entity_type, entity_id, company_id, spv_id");

  if (filters.companyId) threadQuery = threadQuery.eq("company_id", filters.companyId);
  if (filters.spvId) threadQuery = threadQuery.eq("spv_id", filters.spvId);

  const { data: threads } = await threadQuery.limit(20);
  if (!threads?.length) return [];

  const threadIds = threads.map((t) => t.id);
  const { data: comments } = await supabase
    .from("collaboration_comments")
    .select("id, thread_id, visibility, is_internal_note, created_at, author_user_id")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(20);

  const threadMap = new Map(threads.map((t) => [t.id, t]));

  return (comments ?? []).map((row) => {
    const thread = threadMap.get(row.thread_id);
    return {
      id: `collaboration_comment:${row.id}`,
      source: "collaboration_comment",
      eventType: "comment_created",
      title: "Collaboration comment (metadata only)",
      description: null,
      severity: "info",
      status: row.visibility,
      entityType: thread?.entity_type ?? null,
      entityId: thread?.entity_id ?? null,
      companyId: thread?.company_id ?? null,
      investorId: null,
      spvId: thread?.spv_id ?? null,
      actorUserId: row.author_user_id,
      sourceModule: "collaboration",
      createdAt: row.created_at,
      metadata: {
        visibility: row.visibility,
        is_internal_note: row.is_internal_note,
      },
    };
  });
}

export async function getAuditComplianceTimeline(
  supabase: SupabaseClient<Database>,
  filters: AuditComplianceFilters,
): Promise<AuditTimelineEntry[]> {
  const [auditLogs, compliance, operational, automation, orchestration, digests, imports, collaboration] =
    await Promise.all([
      loadAuditLogs(supabase, filters),
      loadComplianceEvents(supabase, filters),
      loadOperationalActivity(supabase, filters),
      loadAutomationRuns(supabase, filters),
      loadOrchestrationRuns(supabase, filters),
      loadDigestRuns(supabase, filters),
      loadImportBatches(supabase, filters),
      loadCollaborationMeta(supabase, filters),
    ]);

  const merged = [
    ...auditLogs.map((e) =>
      e.eventType.includes("report_generated") ? { ...e, source: "report_audit" as const } : e,
    ),
    ...compliance,
    ...operational,
    ...automation,
    ...orchestration,
    ...digests,
    ...imports,
    ...collaboration,
  ];

  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return applyAuditTimelineFilters(merged, filters);
}
