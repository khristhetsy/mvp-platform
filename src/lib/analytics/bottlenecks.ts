import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { BottleneckEntityRow, BottleneckItem, TrendWindowDays } from "@/lib/analytics/types";
import { getCompanyWorkspaceHref, getDrilldownHref } from "@/lib/ui/drilldown-links";

function ageDays(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export async function loadBottlenecks(
  supabase: SupabaseClient<Database>,
  windowDays: TrendWindowDays,
): Promise<{ cards: BottleneckItem[]; entities: BottleneckEntityRow[] }> {
  const cards: BottleneckItem[] = [];
  const entities: BottleneckEntityRow[] = [];

  const [companiesPending, spvsPendingReqs, complianceAging, overdueActions, failedImports, failedAutomation, investorBacklog, lowReadinessReports] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id, company_name, review_status, created_at")
        .eq("review_status", "pending")
        .order("created_at", { ascending: true })
        .limit(25),
      supabase
        .from("spv_opportunities")
        .select("id, name, status, created_at, investor_pending_requirements_count")
        .gt("investor_pending_requirements_count", 0)
        .order("created_at", { ascending: true })
        .limit(25),
      supabase
        .from("compliance_events")
        .select("id, title, severity, status, created_at")
        .in("status", ["open", "under_review"])
        .order("created_at", { ascending: true })
        .limit(25),
      supabase
        .from("next_best_actions")
        .select("id, title, role, updated_at, created_at")
        .eq("status", "overdue")
        .order("updated_at", { ascending: true })
        .limit(25),
      supabase
        .from("import_batches")
        .select("id, import_type, file_name, status, created_at")
        .eq("status", "failed")
        .order("created_at", { ascending: true })
        .limit(20),
      supabase
        .from("automation_runs")
        .select("id, status, trigger_type, started_at")
        .in("status", ["failed", "partial"])
        .order("started_at", { ascending: true })
        .limit(20),
      supabase
        .from("investor_profiles")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "pending"),
      supabase
        .from("diligence_reports")
        .select("company_id, readiness_score, created_at")
        .lt("readiness_score", 60)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const pendingCompanies = companiesPending.data ?? [];
  cards.push({
    key: "companies_stuck_review",
    label: "Companies stuck in review",
    severity: pendingCompanies.length >= 10 ? "high" : pendingCompanies.length > 0 ? "medium" : "low",
    count: pendingCompanies.length,
    href: getDrilldownHref("companies_pending"),
    description: "Companies awaiting institutional review or changes resolution.",
  });
  for (const row of pendingCompanies.slice(0, 10)) {
    entities.push({
      entityType: "company",
      entityId: row.id,
      label: row.company_name ?? "Company",
      ageDays: ageDays(row.created_at),
      href: getCompanyWorkspaceHref(row.id),
      reason: `Review status: ${row.review_status ?? "pending"}`,
    });
  }

  const spvRows = spvsPendingReqs.data ?? [];
  cards.push({
    key: "spvs_stuck_requirements",
    label: "SPVs stuck in investor requirements",
    severity: spvRows.length >= 10 ? "high" : spvRows.length > 0 ? "medium" : "low",
    count: spvRows.length,
    href: getDrilldownHref("spv_activity"),
    description: "SPVs with outstanding investor requirements blocking readiness.",
  });
  for (const row of spvRows.slice(0, 10)) {
    entities.push({
      entityType: "spv",
      entityId: row.id,
      label: row.name ?? "SPV",
      ageDays: ageDays(row.created_at),
      href: "/admin/spvs",
      reason: `${row.investor_pending_requirements_count ?? 0} pending investor requirements`,
    });
  }

  const complianceRows = complianceAging.data ?? [];
  const criticalCount = complianceRows.filter((r) => r.severity === "critical").length;
  cards.push({
    key: "compliance_aging",
    label: "Compliance items aging",
    severity: criticalCount > 0 ? "critical" : complianceRows.length > 0 ? "high" : "low",
    count: complianceRows.length,
    href: getDrilldownHref("compliance_open"),
    description: "Open compliance events (critical/high should be prioritized).",
  });
  for (const row of complianceRows.slice(0, 10)) {
    entities.push({
      entityType: "compliance_event",
      entityId: row.id,
      label: row.title ?? "Compliance event",
      ageDays: ageDays(row.created_at),
      href: getDrilldownHref(row.severity === "critical" ? "compliance_critical" : "compliance_open"),
      reason: `${row.severity} · ${row.status}`,
    });
  }

  const overdueRows = overdueActions.data ?? [];
  cards.push({
    key: "actions_overdue",
    label: "Actions overdue",
    severity: overdueRows.length > 25 ? "high" : overdueRows.length > 0 ? "medium" : "low",
    count: overdueRows.length,
    href: "/admin/actions?tab=overdue&overdue=true",
    description: "Next-best-actions past due date or marked overdue.",
  });
  for (const row of overdueRows.slice(0, 10)) {
    entities.push({
      entityType: "action",
      entityId: row.id,
      label: String(row.title ?? "Overdue action").slice(0, 80),
      ageDays: ageDays((row.updated_at ?? row.created_at) as string),
      href: "/admin/actions",
      reason: "Action status: overdue",
    });
  }

  const failedImportRows = failedImports.data ?? [];
  cards.push({
    key: "imports_failing",
    label: "Imports failing",
    severity: failedImportRows.length > 0 ? "high" : "low",
    count: failedImportRows.length,
    href: "/admin/imports",
    description: `Import batches failed (last ${windowDays} days shown elsewhere).`,
  });
  for (const row of failedImportRows.slice(0, 10)) {
    entities.push({
      entityType: "import_batch",
      entityId: row.id,
      label: `Import: ${row.import_type ?? "unknown"}`,
      ageDays: ageDays(row.created_at),
      href: "/admin/imports",
      reason: String(row.file_name ?? "").slice(0, 80) || "Failed import batch",
    });
  }

  const failedAutomationRows = failedAutomation.data ?? [];
  cards.push({
    key: "automation_failures",
    label: "Automation failures",
    severity: failedAutomationRows.length > 0 ? "medium" : "low",
    count: failedAutomationRows.length,
    href: "/admin/automation",
    description: "Failed or partial automation runs in the recent period.",
  });
  for (const row of failedAutomationRows.slice(0, 10)) {
    entities.push({
      entityType: "automation_run",
      entityId: row.id,
      label: `Automation: ${row.trigger_type ?? "unknown"}`,
      ageDays: ageDays(row.started_at),
      href: "/admin/automation",
      reason: `Run status: ${row.status}`,
    });
  }

  cards.push({
    key: "investor_approval_backlog",
    label: "Investor approval backlog",
    severity: (investorBacklog.count ?? 0) > 10 ? "high" : (investorBacklog.count ?? 0) > 0 ? "medium" : "low",
    count: investorBacklog.count ?? 0,
    href: getDrilldownHref("investors_pending"),
    description: "Investor profiles pending approval (staff queue).",
  });

  const lowReadinessRows = lowReadinessReports.data ?? [];
  cards.push({
    key: "companies_low_readiness",
    label: "Low readiness companies",
    severity: lowReadinessRows.length > 10 ? "medium" : lowReadinessRows.length > 0 ? "low" : "low",
    count: lowReadinessRows.length,
    href: getDrilldownHref("companies_all"),
    description: "Companies with recent diligence readiness score below 60.",
  });
  const lowCompanyIds = [...new Set(lowReadinessRows.map((r) => r.company_id).filter(Boolean))] as string[];
  const { data: lowCompanies } = lowCompanyIds.length
    ? await supabase.from("companies").select("id, company_name, created_at").in("id", lowCompanyIds).limit(25)
    : { data: [] as { id: string; company_name: string | null; created_at: string }[] };
  const companyMap = new Map((lowCompanies ?? []).map((c) => [c.id, c]));
  for (const row of lowReadinessRows.slice(0, 10)) {
    const company = companyMap.get(row.company_id);
    entities.push({
      entityType: "company",
      entityId: row.company_id,
      label: company?.company_name ?? "Company",
      ageDays: ageDays(company?.created_at ?? row.created_at),
      href: getCompanyWorkspaceHref(row.company_id),
      reason: `Readiness score: ${row.readiness_score ?? "—"}`,
    });
  }

  return { cards, entities };
}

