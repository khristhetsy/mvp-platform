import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminDashboardMetrics } from "@/lib/data/admin";
import { getComplianceMetrics } from "@/lib/compliance/events";
import { getAdminQueueSummary } from "@/lib/queues/admin-queues";
import { getOperationalActivityFeed } from "@/lib/operational-activity/event-queries";
import type { SanitizedAssistantContext } from "@/lib/assistant/types";
import {
  inferAssistantMode,
  parseEntityFromPath,
  workspaceLabelForRole,
} from "@/lib/assistant/assistant-context";
import type { Profile, Database } from "@/lib/supabase/types";

async function loadEntityLabel(
  supabase: SupabaseClient<Database>,
  entity: { type: string; id: string } | null,
): Promise<string | null> {
  if (!entity) return null;

  if (entity.type === "company") {
    const { data } = await supabase.from("companies").select("company_name, review_status").eq("id", entity.id).maybeSingle();
    return data ? `${data.company_name} (${data.review_status ?? "unknown"})` : null;
  }
  if (entity.type === "investor") {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", entity.id)
      .maybeSingle();
    return data?.full_name ?? data?.email ?? null;
  }
  if (entity.type === "spv") {
    const { data } = await supabase
      .from("spv_opportunities")
      .select("name, status, checklist_readiness_pct")
      .eq("id", entity.id)
      .maybeSingle();
    return data ? `${data.name} — ${data.status} (${data.checklist_readiness_pct ?? 0}% ready)` : null;
  }

  return null;
}

export async function loadAdminAssistantContext(
  profile: Profile,
  supabase: SupabaseClient<Database>,
  input: {
    currentPath?: string;
    mode?: SanitizedAssistantContext["mode"];
    entityType?: string;
    entityId?: string;
  },
): Promise<SanitizedAssistantContext> {
  const role = profile.role === "analyst" ? "analyst" : "admin";
  const currentPath = input.currentPath ?? null;
  const mode = inferAssistantMode({ role, currentPath, requestedMode: input.mode });

  const [metrics, queueSummary, compliance, activityFeed, pendingInvestorApprovals, importBatches] =
    await Promise.all([
      getAdminDashboardMetrics(supabase),
      getAdminQueueSummary(supabase).catch(() => []),
      getComplianceMetrics(supabase).catch(() => ({ openEvents: 0 })),
      getOperationalActivityFeed(supabase, { limit: 5 }).catch(() => ({ items: [], total: 0, hasMore: false })),
      supabase
        .from("investor_profiles")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "pending"),
      supabase.from("import_batches").select("id", { count: "exact", head: true }).in("status", ["uploaded", "validated"]),
    ]);

  const queueMap = Object.fromEntries(queueSummary.map((row) => [row.queue_type, row.count]));

  const summary: SanitizedAssistantContext["summary"] = {
    totalCompanies: metrics.companies,
    pendingCompanyReviews: metrics.pendingReviews,
    pendingInvestorApprovals: pendingInvestorApprovals.count ?? 0,
    publishedDeals: metrics.publishedDeals,
    totalDocuments: metrics.documents,
    complianceEscalations: compliance.openEvents ?? 0,
    spvBlockers: queueMap.spv_blockers ?? 0,
    investorDocumentsQueue: queueMap.investor_documents ?? 0,
    founderRemediationQueue: queueMap.founder_remediation ?? 0,
    importsExportsQueue: queueMap.imports_exports ?? 0,
    pendingImports: importBatches.count ?? 0,
    recentActivityCount: activityFeed.total,
    reportsAvailable: true,
  };

  const highlights: string[] = [];
  if (Number(summary.pendingCompanyReviews) > 0) {
    highlights.push(`${summary.pendingCompanyReviews} companies are awaiting institutional review.`);
  }
  if (Number(summary.pendingInvestorApprovals) > 0) {
    highlights.push(`${summary.pendingInvestorApprovals} investor profiles await approval.`);
  }
  if (Number(summary.complianceEscalations) > 0) {
    highlights.push(`${summary.complianceEscalations} compliance events remain open.`);
  }
  if (Number(summary.spvBlockers) > 0) {
    highlights.push(`${summary.spvBlockers} SPV items are flagged as blockers in operational queues.`);
  }
  if (highlights.length === 0) {
    highlights.push("Core review queues appear clear — monitor operational activity for new items.");
  }

  const parsedEntity = parseEntityFromPath(currentPath);
  const entityRef =
    input.entityType && input.entityId
      ? { type: input.entityType, id: input.entityId }
      : parsedEntity;
  const entityLabel = await loadEntityLabel(supabase, entityRef);

  return {
    role,
    mode,
    workspaceLabel: workspaceLabelForRole(role),
    currentPath,
    entity: entityRef ? { ...entityRef, label: entityLabel } : null,
    summary,
    highlights,
  };
}
