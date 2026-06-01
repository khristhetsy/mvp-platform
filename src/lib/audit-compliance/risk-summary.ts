import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditRiskSummary } from "@/lib/audit-compliance/types";
import type { Database } from "@/lib/supabase/types";

function dayStartIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getAuditRiskSummary(supabase: SupabaseClient<Database>): Promise<AuditRiskSummary> {
  const dayStart = dayStartIso();

  const [
    critical,
    high,
    overdue,
    escalated,
    failedAutomation,
    failedOrchestration,
    failedImports,
    spvBlockers,
    repeatCompanies,
  ] = await Promise.all([
    supabase
      .from("compliance_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "critical")
      .in("status", ["open", "under_review"]),
    supabase
      .from("compliance_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "high")
      .in("status", ["open", "under_review"]),
    supabase.from("next_best_actions").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    supabase.from("next_best_actions").select("id", { count: "exact", head: true }).eq("status", "escalated"),
    supabase
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", dayStart)
      .in("status", ["failed", "partial"]),
    supabase
      .from("orchestration_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", dayStart)
      .in("status", ["failed", "partial"]),
    supabase
      .from("import_batches")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayStart)
      .gt("failed_rows", 0),
    supabase
      .from("next_best_actions")
      .select("id", { count: "exact", head: true })
      .eq("category", "spv")
      .in("status", ["open", "blocked", "escalated", "overdue"]),
    supabase
      .from("compliance_events")
      .select("company_id")
      .not("company_id", "is", null)
      .in("status", ["open", "under_review"])
      .limit(500),
  ]);

  const companyCounts = new Map<string, number>();
  for (const row of repeatCompanies.data ?? []) {
    if (!row.company_id) continue;
    companyCounts.set(row.company_id, (companyCounts.get(row.company_id) ?? 0) + 1);
  }
  const companiesWithRepeatedFlags = [...companyCounts.values()].filter((c) => c >= 2).length;

  return {
    openCriticalCompliance: critical.count ?? 0,
    openHighCompliance: high.count ?? 0,
    overdueActions: overdue.count ?? 0,
    escalatedWorkflows: escalated.count ?? 0,
    failedAutomationRunsToday: failedAutomation.count ?? 0,
    failedOrchestrationRunsToday: failedOrchestration.count ?? 0,
    failedImportsToday: failedImports.count ?? 0,
    unresolvedSpvBlockers: spvBlockers.count ?? 0,
    companiesWithRepeatedFlags,
  };
}
