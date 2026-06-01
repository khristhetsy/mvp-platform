import type { SupabaseClient } from "@supabase/supabase-js";
import { buildActionId, createNextBestAction } from "@/lib/next-best-actions/action-catalog";
import type { NextBestAction } from "@/lib/next-best-actions/types";
import { getComplianceMetrics } from "@/lib/compliance/events";
import { getAdminDashboardMetrics } from "@/lib/data/admin";
import { getOperationalActivityFeed } from "@/lib/operational-activity/event-queries";
import {
  getAdminQueueItems,
  getAdminQueueSummary,
  type AdminQueueItem,
  type AdminQueueType,
} from "@/lib/queues/admin-queues";
import type { Database } from "@/lib/supabase/types";

export type AdminNbaContext = {
  pendingCompanyReviews: number;
  pendingInvestorApprovals: number;
  complianceEscalations: number;
  criticalCompliance: number;
  spvBlockers: number;
  investorDocuments: number;
  failedImports: number;
  pendingImports: number;
  recentHighSeverityActivity: number;
  serviceRoleConfigured: boolean;
  queueItems: Partial<Record<AdminQueueType, AdminQueueItem[]>>;
};

export async function loadAdminNbaContext(supabase: SupabaseClient<Database>): Promise<AdminNbaContext> {
  const [
    metrics,
    queueSummary,
    compliance,
    activityFeed,
    failedImports,
    pendingImports,
    criticalCompliance,
    companyReviewItems,
    investorApprovalItems,
    complianceItems,
    spvBlockerItems,
    investorDocItems,
    importItems,
  ] = await Promise.all([
    getAdminDashboardMetrics(supabase),
    getAdminQueueSummary(supabase).catch(() => []),
    getComplianceMetrics(supabase).catch(() => ({ openEvents: 0 })),
    getOperationalActivityFeed(supabase, { limit: 20 }).catch(() => ({ items: [], total: 0, hasMore: false })),
    supabase.from("import_batches").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("import_batches").select("id", { count: "exact", head: true }).eq("status", "validated"),
    supabase
      .from("compliance_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "critical")
      .in("status", ["open", "under_review"]),
    getAdminQueueItems(supabase, "company_reviews", { limit: 5 }).catch(() => []),
    getAdminQueueItems(supabase, "investor_approvals", { limit: 5 }).catch(() => []),
    getAdminQueueItems(supabase, "compliance_escalations", { limit: 5 }).catch(() => []),
    getAdminQueueItems(supabase, "spv_blockers", { limit: 5 }).catch(() => []),
    getAdminQueueItems(supabase, "investor_documents", { limit: 5 }).catch(() => []),
    getAdminQueueItems(supabase, "imports_exports", { limit: 5 }).catch(() => []),
  ]);

  const queueMap = Object.fromEntries(queueSummary.map((row) => [row.queue_type, row.count]));
  const recentHighSeverityActivity = activityFeed.items.filter((item) =>
    ["high", "critical"].includes(item.severity),
  ).length;

  return {
    pendingCompanyReviews: metrics.pendingReviews,
    pendingInvestorApprovals: queueMap.investor_approvals ?? 0,
    complianceEscalations: compliance.openEvents ?? 0,
    criticalCompliance: criticalCompliance.count ?? 0,
    spvBlockers: queueMap.spv_blockers ?? 0,
    investorDocuments: queueMap.investor_documents ?? 0,
    failedImports: failedImports.count ?? 0,
    pendingImports: pendingImports.count ?? 0,
    recentHighSeverityActivity,
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    queueItems: {
      company_reviews: companyReviewItems,
      investor_approvals: investorApprovalItems,
      compliance_escalations: complianceItems,
      spv_blockers: spvBlockerItems,
      investor_documents: investorDocItems,
      imports_exports: importItems,
    },
  };
}

function queueItemToAction(item: AdminQueueItem, role: "admin" | "analyst"): NextBestAction {
  const priority =
    item.severity === "critical" || item.severity === "danger"
      ? "critical"
      : item.severity === "high" || item.queue_type === "compliance_escalations"
        ? "high"
        : item.severity === "warning" || item.severity === "medium"
          ? "medium"
          : "low";

  const category =
    item.queue_type === "compliance_escalations"
      ? "compliance"
      : item.queue_type === "spv_blockers" || item.queue_type === "investor_documents"
        ? "spv"
        : item.queue_type === "imports_exports"
          ? "reporting"
          : "admin_review";

  return createNextBestAction({
    id: buildActionId(["admin", item.queue_type, item.id]),
    role,
    title: item.title,
    description: item.subtitle ?? item.next_action_label,
    priority,
    category,
    entityType: item.entity_type,
    entityId: item.entity_id,
    companyId: item.company_id ?? undefined,
    investorId: item.investor_id ?? undefined,
    spvId: item.spv_id ?? undefined,
    href: item.href,
    sourceModule: "admin_queues",
    reason: item.next_action_label,
    createdFrom: "admin_queue_item",
    metadata: { queue_type: item.queue_type, status: item.status },
    urgencyAt: item.created_at,
  });
}

export function computeAdminActions(
  ctx: AdminNbaContext,
  role: "admin" | "analyst",
  entityFilter?: { entityType?: string; entityId?: string },
): NextBestAction[] {
  const actions: NextBestAction[] = [];

  if (!ctx.serviceRoleConfigured) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["admin", "service_role"]),
        role,
        title: "Configure service role",
        description: "Admin operational queues require SUPABASE_SERVICE_ROLE_KEY for full data access.",
        priority: "critical",
        category: "system",
        entityType: "system",
        href: "/admin/system-health",
        sourceModule: "system",
        reason: "Service role key is not configured.",
        createdFrom: "admin_nba",
      }),
    );
  }

  if (ctx.criticalCompliance > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["admin", "compliance_critical"]),
        role,
        title: "Resolve critical compliance events",
        description: `${ctx.criticalCompliance} critical compliance ${ctx.criticalCompliance === 1 ? "event" : "events"} require immediate review.`,
        priority: "critical",
        category: "compliance",
        entityType: "compliance",
        href: "/admin/compliance?severity=critical",
        sourceModule: "compliance",
        reason: "Critical severity compliance events are open.",
        createdFrom: "admin_nba",
      }),
    );
  } else if (ctx.complianceEscalations > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["admin", "compliance_escalations"]),
        role,
        title: "Review compliance escalations",
        description: `${ctx.complianceEscalations} high-severity compliance ${ctx.complianceEscalations === 1 ? "event" : "events"} are open.`,
        priority: "high",
        category: "compliance",
        entityType: "compliance",
        href: "/admin/compliance",
        sourceModule: "compliance",
        reason: "Compliance queue has open escalations.",
        createdFrom: "admin_nba",
      }),
    );
  }

  if (ctx.pendingCompanyReviews > 0) {
    const top = ctx.queueItems.company_reviews?.[0];
    actions.push(
      createNextBestAction({
        id: buildActionId(["admin", "company_reviews"]),
        role,
        title: top ? `Review company: ${top.title}` : "Review pending companies",
        description: `${ctx.pendingCompanyReviews} ${ctx.pendingCompanyReviews === 1 ? "company awaits" : "companies await"} institutional review.`,
        priority: "high",
        category: "admin_review",
        entityType: top?.entity_type ?? "company",
        entityId: top?.entity_id,
        companyId: top?.company_id ?? undefined,
        href: top?.href ?? "/admin/queues?queue=company_reviews",
        sourceModule: "admin_queues",
        reason: "Company review queue has pending items.",
        createdFrom: "admin_nba",
        urgencyAt: top?.created_at,
      }),
    );
  }

  if (ctx.pendingInvestorApprovals > 0) {
    const top = ctx.queueItems.investor_approvals?.[0];
    actions.push(
      createNextBestAction({
        id: buildActionId(["admin", "investor_approvals"]),
        role,
        title: top ? `Approve investor: ${top.title}` : "Review investor approvals",
        description: `${ctx.pendingInvestorApprovals} investor ${ctx.pendingInvestorApprovals === 1 ? "profile" : "profiles"} submitted for approval.`,
        priority: "high",
        category: "admin_review",
        entityType: top?.entity_type ?? "investor",
        entityId: top?.entity_id,
        investorId: top?.investor_id ?? undefined,
        href: top?.href ?? "/admin/queues?queue=investor_approvals",
        sourceModule: "admin_queues",
        reason: "Investor approval queue is active.",
        createdFrom: "admin_nba",
        urgencyAt: top?.created_at,
      }),
    );
  }

  if (ctx.spvBlockers > 0) {
    const top = ctx.queueItems.spv_blockers?.[0];
    actions.push(
      createNextBestAction({
        id: buildActionId(["admin", "spv_blockers"]),
        role,
        title: top ? `SPV blocker: ${top.title}` : "Review SPV blockers",
        description: `${ctx.spvBlockers} SPV ${ctx.spvBlockers === 1 ? "item needs" : "items need"} operational attention.`,
        priority: "high",
        category: "spv",
        entityType: top?.entity_type ?? "spv",
        entityId: top?.entity_id,
        spvId: top?.spv_id ?? undefined,
        companyId: top?.company_id ?? undefined,
        href: top?.href ?? "/admin/queues?queue=spv_blockers",
        sourceModule: "spv",
        reason: "SPV operational readiness is blocked.",
        createdFrom: "admin_nba",
        urgencyAt: top?.created_at,
      }),
    );
  }

  if (ctx.investorDocuments > 0) {
    const top = ctx.queueItems.investor_documents?.[0];
    actions.push(
      createNextBestAction({
        id: buildActionId(["admin", "investor_documents"]),
        role,
        title: "Review investor SPV documents",
        description: `${ctx.investorDocuments} investor document requirement${ctx.investorDocuments === 1 ? "" : "s"} pending review.`,
        priority: "medium",
        category: "spv",
        entityType: top?.entity_type ?? "spv_requirement",
        entityId: top?.entity_id,
        spvId: top?.spv_id ?? undefined,
        href: top?.href ?? "/admin/queues?queue=investor_documents",
        sourceModule: "spv_requirements",
        reason: "Uploaded requirements await staff review.",
        createdFrom: "admin_nba",
        urgencyAt: top?.created_at,
      }),
    );
  }

  if (ctx.failedImports > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["admin", "failed_imports"]),
        role,
        title: "Review failed imports",
        description: `${ctx.failedImports} import batch${ctx.failedImports === 1 ? "" : "es"} failed and need review.`,
        priority: "high",
        category: "reporting",
        entityType: "import_batch",
        href: "/admin/imports",
        sourceModule: "imports",
        reason: "Import failures may block CRM or company data updates.",
        createdFrom: "admin_nba",
      }),
    );
  } else if (ctx.pendingImports > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["admin", "pending_imports"]),
        role,
        title: "Confirm pending imports",
        description: `${ctx.pendingImports} import batch${ctx.pendingImports === 1 ? "" : "es"} validated and awaiting confirmation.`,
        priority: "medium",
        category: "reporting",
        entityType: "import_batch",
        href: "/admin/imports",
        sourceModule: "imports",
        reason: "Validated imports should be confirmed or rejected.",
        createdFrom: "admin_nba",
      }),
    );
  }

  if (ctx.recentHighSeverityActivity >= 5) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["admin", "activity_spike"]),
        role,
        title: "Review operational activity spike",
        description: `${ctx.recentHighSeverityActivity} recent high-severity operational events detected.`,
        priority: "medium",
        category: "system",
        entityType: "system",
        href: "/admin",
        sourceModule: "operational_activity",
        reason: "Elevated high/critical activity in the recent feed.",
        createdFrom: "admin_nba",
      }),
    );
  }

  const queueDerived: NextBestAction[] = [];
  for (const items of Object.values(ctx.queueItems)) {
    if (!items) continue;
    for (const item of items.slice(0, 2)) {
      if (entityFilter?.entityType && entityFilter.entityId) {
        const matchesCompany = item.company_id === entityFilter.entityId;
        const matchesSpv = item.spv_id === entityFilter.entityId;
        const matchesInvestor = item.investor_id === entityFilter.entityId || item.entity_id === entityFilter.entityId;
        const matchesEntity = item.entity_id === entityFilter.entityId;
        if (entityFilter.entityType === "company" && !matchesCompany && !matchesEntity) continue;
        if (entityFilter.entityType === "spv" && !matchesSpv && !matchesEntity) continue;
        if (entityFilter.entityType === "investor" && !matchesInvestor) continue;
      }
      queueDerived.push(queueItemToAction(item, role));
    }
  }

  const merged = [...actions, ...queueDerived];

  if (merged.length === 0) {
    merged.push(
      createNextBestAction({
        id: buildActionId(["admin", "queues_clear"]),
        role,
        title: "Queues are clear",
        description: "Core review queues have no pending items. Monitor operational activity for new work.",
        priority: "low",
        category: "system",
        entityType: "system",
        href: "/admin/queues",
        sourceModule: "admin_queues",
        reason: "No high-priority queue items at this time.",
        createdFrom: "admin_nba",
      }),
    );
  }

  return merged;
}
