import type { SupabaseClient } from "@supabase/supabase-js";
import { formatOperationalReadinessLabel } from "@/lib/spv/readiness";
import type { Database } from "@/lib/supabase/types";

export const ADMIN_QUEUE_TYPES = [
  "company_reviews",
  "investor_approvals",
  "compliance_escalations",
  "spv_blockers",
  "investor_documents",
  "founder_remediation",
  "imports_exports",
] as const;

export type AdminQueueType = (typeof ADMIN_QUEUE_TYPES)[number];

export type AdminQueueItem = {
  id: string;
  queue_type: AdminQueueType;
  title: string;
  subtitle: string | null;
  entity_type: string;
  entity_id: string;
  company_id: string | null;
  investor_id: string | null;
  spv_id: string | null;
  severity: string;
  status: string;
  next_action_label: string;
  href: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type AdminQueueSummaryItem = {
  queue_type: AdminQueueType;
  label: string;
  count: number;
  href: string;
  status: "neutral" | "info" | "success" | "warning" | "danger" | "pending";
  detail: string;
};

export type AdminQueueFilters = {
  search?: string;
  severity?: string;
  status?: string;
  limit?: number;
};

export type AdminQueuesSnapshot = {
  summary: AdminQueueSummaryItem[];
  itemsByQueue: Record<AdminQueueType, AdminQueueItem[]>;
};

const DEFAULT_LIMIT = 50;

function queueHref(queueType: AdminQueueType): string {
  return `/admin/queues?queue=${queueType}`;
}

function matchesSearch(item: AdminQueueItem, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [item.title, item.subtitle, item.status, item.next_action_label]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

function applyFilters(items: AdminQueueItem[], filters?: AdminQueueFilters): AdminQueueItem[] {
  let result = items;
  if (filters?.severity) {
    result = result.filter((item) => item.severity === filters.severity);
  }
  if (filters?.status) {
    result = result.filter((item) => item.status === filters.status);
  }
  if (filters?.search) {
    result = result.filter((item) => matchesSearch(item, filters.search!));
  }
  const limit = filters?.limit ?? DEFAULT_LIMIT;
  return result.slice(0, limit);
}

async function loadCompanyReviewItems(supabase: SupabaseClient<Database>, limit: number): Promise<AdminQueueItem[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, company_name, review_status, created_at, onboarding_progress_percent, founder_id")
    .in("review_status", ["pending", "changes_requested"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const companyIds = rows.map((row) => row.id);
  const founderIds = [...new Set(rows.map((row) => row.founder_id))];

  const [{ data: founders }, { data: reports }] = await Promise.all([
    founderIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", founderIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
    companyIds.length
      ? supabase
          .from("diligence_reports")
          .select("company_id, readiness_score, created_at")
          .in("company_id", companyIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { company_id: string; readiness_score: number | null }[] }),
  ]);

  const founderMap = new Map((founders ?? []).map((row) => [row.id, row]));
  const readinessByCompany = new Map<string, number | null>();
  for (const report of reports ?? []) {
    if (!readinessByCompany.has(report.company_id)) {
      readinessByCompany.set(report.company_id, report.readiness_score);
    }
  }

  return rows.map((row) => {
    const founder = founderMap.get(row.founder_id);
    const readiness = readinessByCompany.get(row.id);
    return {
      id: `company_review:${row.id}`,
      queue_type: "company_reviews" as const,
      title: row.company_name,
      subtitle: founder?.full_name ?? founder?.email ?? null,
      entity_type: "company",
      entity_id: row.id,
      company_id: row.id,
      investor_id: null,
      spv_id: null,
      severity: row.review_status === "changes_requested" ? "medium" : "info",
      status: row.review_status ?? "pending",
      next_action_label: "Review company",
      href: `/admin/companies/${row.id}`,
      created_at: row.created_at,
      metadata: {
        onboarding_progress_percent: row.onboarding_progress_percent,
        readiness_score: readiness,
      },
    };
  });
}

async function loadInvestorApprovalItems(supabase: SupabaseClient<Database>, limit: number): Promise<AdminQueueItem[]> {
  const { data, error } = await supabase
    .from("investor_profiles")
    .select("id, profile_id, firm_name, investor_type, accredited_status, approval_status, submitted_at, created_at")
    .eq("approval_status", "submitted")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const profileIds = rows.map((row) => row.profile_id);
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const profileMap = new Map((profiles ?? []).map((row) => [row.id, row]));

  return rows.map((row) => {
    const profile = profileMap.get(row.profile_id);
    return {
      id: `investor_approval:${row.id}`,
      queue_type: "investor_approvals" as const,
      title: profile?.full_name ?? profile?.email ?? "Investor",
      subtitle: row.firm_name,
      entity_type: "investor_profile",
      entity_id: row.id,
      company_id: null,
      investor_id: row.profile_id,
      spv_id: null,
      severity: "medium",
      status: row.approval_status,
      next_action_label: "Review investor",
      href: `/admin/investors/${row.profile_id}`,
      created_at: row.submitted_at ?? row.created_at,
      metadata: {
        investor_type: row.investor_type,
        accredited_status: row.accredited_status,
      },
    };
  });
}

async function loadComplianceEscalationItems(
  supabase: SupabaseClient<Database>,
  limit: number,
): Promise<AdminQueueItem[]> {
  const { data, error } = await supabase
    .from("compliance_events")
    .select("id, title, severity, status, company_id, investor_id, created_at")
    .in("severity", ["high", "critical"])
    .in("status", ["open", "under_review"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const companyIds = [...new Set((data ?? []).map((row) => row.company_id).filter(Boolean))] as string[];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, company_name").in("id", companyIds)
    : { data: [] as { id: string; company_name: string }[] };
  const companyMap = new Map((companies ?? []).map((row) => [row.id, row.company_name]));

  return (data ?? []).map((row) => ({
    id: `compliance:${row.id}`,
    queue_type: "compliance_escalations" as const,
    title: row.title,
    subtitle: row.company_id ? (companyMap.get(row.company_id) ?? "Company context") : "Platform-wide",
    entity_type: "compliance_event",
    entity_id: row.id,
    company_id: row.company_id,
    investor_id: row.investor_id,
    spv_id: null,
    severity: row.severity,
    status: row.status,
    next_action_label: "Review compliance event",
    href: row.investor_id
      ? `/admin/investors/${row.investor_id}`
      : row.company_id
        ? `/admin/companies/${row.company_id}`
        : row.severity === "critical"
          ? `/admin/compliance?severity=critical&event=${row.id}`
          : `/admin/compliance?status=open&event=${row.id}`,
    created_at: row.created_at,
    metadata: {},
  }));
}

async function loadSpvBlockerItems(supabase: SupabaseClient<Database>, limit: number): Promise<AdminQueueItem[]> {
  const { data, error } = await supabase
    .from("spv_opportunities")
    .select(
      "id, name, status, company_id, operational_readiness_status, checklist_readiness_pct, investor_pending_requirements_count, closing_readiness_pct, updated_at, created_at",
    )
    .in("status", ["draft", "under_review", "open"])
    .or(
      "operational_readiness_status.in.(checklist_incomplete,investors_pending,draft),investor_pending_requirements_count.gt.0,checklist_readiness_pct.lt.100",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const companyIds = [...new Set(rows.map((row) => row.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, company_name").in("id", companyIds)
    : { data: [] as { id: string; company_name: string }[] };
  const companyMap = new Map((companies ?? []).map((row) => [row.id, row.company_name]));

  return rows.map((row) => {
    const readiness = row.operational_readiness_status ?? "draft";
    const readinessPct = row.checklist_readiness_pct ?? 0;
    const blockerLabel = formatOperationalReadinessLabel(
      readiness as Parameters<typeof formatOperationalReadinessLabel>[0],
    );

    return {
      id: `spv_blocker:${row.id}`,
      queue_type: "spv_blockers" as const,
      title: row.name,
      subtitle: companyMap.get(row.company_id) ?? null,
      entity_type: "spv_opportunity",
      entity_id: row.id,
      company_id: row.company_id,
      investor_id: null,
      spv_id: row.id,
      severity: row.investor_pending_requirements_count > 0 ? "high" : "medium",
      status: readiness,
      next_action_label: "Open SPV",
      href: row.company_id ? `/admin/companies/${row.company_id}` : `/admin/spvs?spv=${row.id}`,
      created_at: row.updated_at ?? row.created_at,
      metadata: {
        readiness_pct: readinessPct,
        pending_investor_requirements: row.investor_pending_requirements_count,
        closing_readiness_pct: row.closing_readiness_pct,
        blocker_label: blockerLabel,
      },
    };
  });
}

async function loadInvestorDocumentItems(supabase: SupabaseClient<Database>, limit: number): Promise<AdminQueueItem[]> {
  const { data, error } = await supabase
    .from("spv_participation_requirements")
    .select("id, title, status, category, created_at, updated_at, spv_opportunity_id, investor_id")
    .in("status", ["pending", "uploaded", "under_review", "rejected"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const spvIds = [...new Set(rows.map((row) => row.spv_opportunity_id))];
  const investorIds = [...new Set(rows.map((row) => row.investor_id))];

  const [{ data: spvs }, { data: investors }] = await Promise.all([
    spvIds.length
      ? supabase.from("spv_opportunities").select("id, name, company_id").in("id", spvIds)
      : Promise.resolve({ data: [] as { id: string; name: string; company_id: string }[] }),
    investorIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", investorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ]);

  const spvMap = new Map((spvs ?? []).map((row) => [row.id, row]));
  const investorMap = new Map((investors ?? []).map((row) => [row.id, row]));
  const companyIds = [...new Set((spvs ?? []).map((row) => row.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, company_name").in("id", companyIds)
    : { data: [] as { id: string; company_name: string }[] };
  const companyMap = new Map((companies ?? []).map((row) => [row.id, row.company_name]));

  return rows.map((row) => {
    const spv = spvMap.get(row.spv_opportunity_id);
    const investor = investorMap.get(row.investor_id);
    return {
      id: `investor_doc:${row.id}`,
      queue_type: "investor_documents" as const,
      title: row.title,
      subtitle: `${investor?.full_name ?? investor?.email ?? "Investor"} · ${spv?.name ?? "SPV"}`,
      entity_type: "spv_participation_requirement",
      entity_id: row.id,
      company_id: spv?.company_id ?? null,
      investor_id: row.investor_id,
      spv_id: row.spv_opportunity_id,
      severity: row.status === "rejected" ? "high" : row.status === "under_review" ? "medium" : "info",
      status: row.status,
      next_action_label: "Review requirement",
      href: `/admin/investors/${row.investor_id}`,
      created_at: row.updated_at ?? row.created_at,
      metadata: {
        category: row.category,
        company_name: spv?.company_id ? (companyMap.get(spv.company_id) ?? null) : null,
      },
    };
  });
}

async function loadFounderRemediationItems(
  supabase: SupabaseClient<Database>,
  limit: number,
): Promise<AdminQueueItem[]> {
  const { data, error } = await supabase
    .from("founder_remediation_tasks")
    .select("id, title, category, priority, status, created_at, company_id")
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const companyIds = [...new Set(rows.map((row) => row.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, company_name").in("id", companyIds)
    : { data: [] as { id: string; company_name: string }[] };
  const companyMap = new Map((companies ?? []).map((row) => [row.id, row.company_name]));

  const priorityRank = { high: 0, medium: 1, low: 2 };
  const sorted = [...rows].sort(
    (a, b) => (priorityRank[a.priority as keyof typeof priorityRank] ?? 9) - (priorityRank[b.priority as keyof typeof priorityRank] ?? 9),
  );

  return sorted.slice(0, limit).map((row) => {
    return {
      id: `remediation:${row.id}`,
      queue_type: "founder_remediation" as const,
      title: row.title,
      subtitle: companyMap.get(row.company_id) ?? null,
      entity_type: "founder_remediation_task",
      entity_id: row.id,
      company_id: row.company_id,
      investor_id: null,
      spv_id: null,
      severity: row.priority === "high" ? "high" : row.priority === "medium" ? "medium" : "low",
      status: row.status,
      next_action_label: "View founder/company",
      href: `/admin/companies/${row.company_id}`,
      created_at: row.created_at,
      metadata: { category: row.category, priority: row.priority },
    };
  });
}

async function loadImportsExportsItems(supabase: SupabaseClient<Database>, limit: number): Promise<AdminQueueItem[]> {
  const items: AdminQueueItem[] = [];

  const { data: batches, error: batchError } = await supabase
    .from("import_batches")
    .select("id, import_type, file_name, status, total_rows, failed_rows, created_rows, updated_rows, created_at, uploaded_by")
    .or("status.eq.failed,status.eq.validated,and(status.eq.completed,failed_rows.gt.0)")
    .order("created_at", { ascending: false })
    .limit(Math.ceil(limit / 2));

  if (batchError) throw new Error(batchError.message);

  const batchRows = batches ?? [];
  const uploaderIds = [...new Set(batchRows.map((row) => row.uploaded_by))];
  const { data: uploaders } = uploaderIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", uploaderIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const uploaderMap = new Map((uploaders ?? []).map((row) => [row.id, row]));

  for (const row of batchRows) {
    const uploader = uploaderMap.get(row.uploaded_by);
    items.push({
      id: `import:${row.id}`,
      queue_type: "imports_exports",
      title: `Import: ${row.import_type}`,
      subtitle: row.file_name,
      entity_type: "import_batch",
      entity_id: row.id,
      company_id: null,
      investor_id: null,
      spv_id: null,
      severity: row.status === "failed" ? "high" : "medium",
      status: row.status,
      next_action_label: "Open imports",
      href: "/admin/imports",
      created_at: row.created_at,
      metadata: {
        uploaded_by: uploader?.full_name ?? uploader?.email ?? null,
        total_rows: row.total_rows,
        failed_rows: row.failed_rows,
        created_rows: row.created_rows,
        updated_rows: row.updated_rows,
      },
    });
  }

  const { data: events, error: eventError } = await supabase
    .from("operational_activity_events")
    .select("id, event_type, title, created_at, actor_user_id, metadata")
    .in("event_type", ["export_generated", "report_generated", "import_completed", "import_previewed"])
    .order("created_at", { ascending: false })
    .limit(Math.ceil(limit / 2));

  if (eventError) throw new Error(eventError.message);

  const eventRows = events ?? [];
  const actorIds = [...new Set(eventRows.map((row) => row.actor_user_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const actorMap = new Map((actors ?? []).map((row) => [row.id, row]));

  for (const row of eventRows) {
    const actor = row.actor_user_id ? actorMap.get(row.actor_user_id) : undefined;
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    items.push({
      id: `activity:${row.id}`,
      queue_type: "imports_exports",
      title: row.title,
      subtitle: actor?.full_name ?? actor?.email ?? "Staff",
      entity_type: "operational_activity_event",
      entity_id: row.id,
      company_id: null,
      investor_id: null,
      spv_id: null,
      severity: "info",
      status: row.event_type,
      next_action_label: row.event_type.includes("report") ? "Open reports" : "Open imports",
      href: row.event_type.includes("report") ? "/admin/reports" : "/admin/imports",
      created_at: row.created_at,
      metadata: meta,
    });
  }

  return items
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

async function countCompanyReviews(supabase: SupabaseClient<Database>) {
  const { count, error } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .in("review_status", ["pending", "changes_requested"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countInvestorApprovals(supabase: SupabaseClient<Database>) {
  const { count, error } = await supabase
    .from("investor_profiles")
    .select("id", { count: "exact", head: true })
    .eq("approval_status", "submitted");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countComplianceEscalations(supabase: SupabaseClient<Database>) {
  const { count, error } = await supabase
    .from("compliance_events")
    .select("id", { count: "exact", head: true })
    .in("severity", ["high", "critical"])
    .in("status", ["open", "under_review"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countSpvBlockers(supabase: SupabaseClient<Database>) {
  const { count, error } = await supabase
    .from("spv_opportunities")
    .select("id", { count: "exact", head: true })
    .in("status", ["draft", "under_review", "open"])
    .or(
      "operational_readiness_status.in.(checklist_incomplete,investors_pending,draft),investor_pending_requirements_count.gt.0,checklist_readiness_pct.lt.100",
    );
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countInvestorDocuments(supabase: SupabaseClient<Database>) {
  const { count, error } = await supabase
    .from("spv_participation_requirements")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "uploaded", "under_review", "rejected"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countFounderRemediation(supabase: SupabaseClient<Database>) {
  const { count, error } = await supabase
    .from("founder_remediation_tasks")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countImportsExports(supabase: SupabaseClient<Database>) {
  const [failedImports, pendingImports, recentActivity] = await Promise.all([
    supabase
      .from("import_batches")
      .select("id", { count: "exact", head: true })
      .or("status.eq.failed,and(status.eq.completed,failed_rows.gt.0)"),
    supabase.from("import_batches").select("id", { count: "exact", head: true }).eq("status", "validated"),
    supabase
      .from("operational_activity_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["export_generated", "report_generated"])
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);
  return (failedImports.count ?? 0) + (pendingImports.count ?? 0) + Math.min(recentActivity.count ?? 0, 10);
}

const QUEUE_LOADERS: Record<AdminQueueType, (supabase: SupabaseClient<Database>, limit: number) => Promise<AdminQueueItem[]>> = {
  company_reviews: loadCompanyReviewItems,
  investor_approvals: loadInvestorApprovalItems,
  compliance_escalations: loadComplianceEscalationItems,
  spv_blockers: loadSpvBlockerItems,
  investor_documents: loadInvestorDocumentItems,
  founder_remediation: loadFounderRemediationItems,
  imports_exports: loadImportsExportsItems,
};

export async function getAdminQueueItems(
  supabase: SupabaseClient<Database>,
  queueType: AdminQueueType,
  filters?: AdminQueueFilters,
): Promise<AdminQueueItem[]> {
  const loader = QUEUE_LOADERS[queueType];
  const limit = filters?.limit ?? DEFAULT_LIMIT;
  const items = await loader(supabase, limit);
  return applyFilters(items, filters);
}

export async function getAdminQueueSummary(supabase: SupabaseClient<Database>): Promise<AdminQueueSummaryItem[]> {
  const [
    companyReviews,
    investorApprovals,
    complianceEscalations,
    spvBlockers,
    investorDocuments,
    founderRemediation,
    importsExports,
  ] = await Promise.all([
    countCompanyReviews(supabase),
    countInvestorApprovals(supabase),
    countComplianceEscalations(supabase),
    countSpvBlockers(supabase),
    countInvestorDocuments(supabase),
    countFounderRemediation(supabase),
    countImportsExports(supabase),
  ]);

  return [
    {
      queue_type: "company_reviews",
      label: "Pending Company Reviews",
      count: companyReviews,
      href: queueHref("company_reviews"),
      status: companyReviews > 0 ? "warning" : "success",
      detail: companyReviews > 0 ? "Review queue active" : "Queue clear",
    },
    {
      queue_type: "investor_approvals",
      label: "Investor Approvals",
      count: investorApprovals,
      href: queueHref("investor_approvals"),
      status: investorApprovals > 0 ? "warning" : "success",
      detail: investorApprovals > 0 ? "Approvals required" : "No pending approvals",
    },
    {
      queue_type: "compliance_escalations",
      label: "Compliance Escalations",
      count: complianceEscalations,
      href: queueHref("compliance_escalations"),
      status: complianceEscalations > 0 ? "danger" : "success",
      detail: complianceEscalations > 0 ? "High/critical events open" : "No escalations",
    },
    {
      queue_type: "spv_blockers",
      label: "SPV Blockers",
      count: spvBlockers,
      href: queueHref("spv_blockers"),
      status: spvBlockers > 0 ? "warning" : "success",
      detail: spvBlockers > 0 ? "SPVs need attention" : "No blockers",
    },
    {
      queue_type: "investor_documents",
      label: "Missing Investor Documents",
      count: investorDocuments,
      href: queueHref("investor_documents"),
      status: investorDocuments > 0 ? "info" : "success",
      detail: investorDocuments > 0 ? "Requirements pending" : "Documents clear",
    },
    {
      queue_type: "founder_remediation",
      label: "Founder Remediation",
      count: founderRemediation,
      href: queueHref("founder_remediation"),
      status: founderRemediation > 0 ? "pending" : "success",
      detail: founderRemediation > 0 ? "Active remediation tasks" : "No open tasks",
    },
    {
      queue_type: "imports_exports",
      label: "Import / Export Review",
      count: importsExports,
      href: queueHref("imports_exports"),
      status: importsExports > 0 ? "info" : "neutral",
      detail: "Imports, exports, and reports",
    },
  ];
}

export async function getAllAdminQueuesSnapshot(
  supabase: SupabaseClient<Database>,
  filters?: AdminQueueFilters,
): Promise<AdminQueuesSnapshot> {
  const summary = await getAdminQueueSummary(supabase);
  const limit = filters?.limit ?? DEFAULT_LIMIT;

  const entries = await Promise.all(
    ADMIN_QUEUE_TYPES.map(async (queueType) => {
      const items = await getAdminQueueItems(supabase, queueType, { ...filters, limit });
      return [queueType, items] as const;
    }),
  );

  const itemsByQueue = Object.fromEntries(entries) as Record<AdminQueueType, AdminQueueItem[]>;
  return { summary, itemsByQueue };
}
