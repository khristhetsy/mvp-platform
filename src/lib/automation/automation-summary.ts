import { createServiceRoleClient } from "@/lib/supabase/admin";
import { resolveEntityDependencies } from "@/lib/automation/dependencies";
import { getAutomationDailySummary } from "@/lib/automation/automation-log";
import type { WorkflowDependency } from "@/lib/automation/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export function isAutomationBlockerIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("what is blocking") ||
    lower.includes("what's blocking") ||
    lower.includes("why can't this advance") ||
    lower.includes("why cant this advance") ||
    lower.includes("dependencies are unresolved") ||
    lower.includes("what happens next") ||
    lower.includes("what automation triggered") ||
    lower.includes("automation triggered this")
  );
}

export function formatDependenciesForAssistant(deps: WorkflowDependency[]): string {
  if (!deps.length) return "No unresolved workflow dependencies detected for this entity.";
  return deps
    .map(
      (d) =>
        `• ${d.blocker}: ${d.dependency}. Next step: ${d.nextRequiredStep} (${d.severity} severity).`,
    )
    .join("\n");
}

export async function loadEntityBlockersForAssistant(
  entityType: string,
  entityId: string,
): Promise<string> {
  const supabase = createServiceRoleClient();
  const deps = await resolveEntityDependencies(supabase, entityType, entityId);
  const unresolved = deps.filter((d) => !d.resolved);
  return formatDependenciesForAssistant(unresolved);
}

export function isAutomationConsoleIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("what automations ran today") ||
    lower.includes("automations ran today") ||
    lower.includes("failed automation") ||
    lower.includes("any failed automation") ||
    lower.includes("what workflows are blocked") ||
    lower.includes("rules are triggering") ||
    lower.includes("rules triggering most") ||
    lower.includes("triggering most") ||
    lower.includes("unresolved dependencies") ||
    lower.includes("automation runs today")
  );
}

export async function formatAutomationConsoleForAssistant(
  supabase?: SupabaseClient<Database>,
): Promise<string> {
  const client = supabase ?? createServiceRoleClient();
  const summary = await getAutomationDailySummary(client);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [failedRuns, topRules, blockedActions] = await Promise.all([
    client
      .from("automation_runs")
      .select("id, status, trigger_type, failures_count, started_at")
      .gte("started_at", dayStart.toISOString())
      .in("status", ["failed", "partial"])
      .order("started_at", { ascending: false })
      .limit(5),
    client
      .from("automation_runs")
      .select("metadata, trigger_type")
      .gte("started_at", dayStart.toISOString())
      .order("started_at", { ascending: false })
      .limit(20),
    client
      .from("next_best_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "blocked"),
  ]);

  const ruleCounts = new Map<string, number>();
  for (const row of topRules.data ?? []) {
    const meta = row.metadata as { results?: Array<{ ruleId: string }> };
    for (const r of meta.results ?? []) {
      ruleCounts.set(r.ruleId, (ruleCounts.get(r.ruleId) ?? 0) + 1);
    }
    if (row.trigger_type) {
      ruleCounts.set(row.trigger_type, (ruleCounts.get(row.trigger_type) ?? 0) + 1);
    }
  }
  const topRulesList = [...ruleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rule, count]) => `• ${rule} (×${count})`)
    .join("\n");

  const failedList = (failedRuns.data ?? [])
    .map(
      (r) =>
        `• ${r.status} — ${r.trigger_type ?? "unknown"} (${r.failures_count} failure(s)) at ${new Date(r.started_at).toLocaleTimeString()}`,
    )
    .join("\n");

  const lines = [
    `Automation runs today: ${summary.automationsTriggeredToday}.`,
    `Failed or partial runs today: ${summary.automationFailuresToday}.`,
    `Blocked workflow actions: ${blockedActions.count ?? summary.blockedWorkflows}.`,
    `Dependencies resolved today: ${summary.dependenciesResolvedToday}.`,
    `Stale automation chains prevented: ${summary.staleChains}.`,
  ];

  if (failedList) lines.push(`Recent failed runs:\n${failedList}`);
  else lines.push("No failed automation runs recorded today.");

  if (topRulesList) lines.push(`Most active rules/triggers today:\n${topRulesList}`);
  else lines.push("No rule trigger frequency data for today yet.");

  lines.push("Open /admin/automation for full run history and manual dry-run controls.");

  return lines.join("\n\n");
}

export async function formatAutomationStatusForAssistant(
  supabase?: SupabaseClient<Database>,
): Promise<string> {
  const client = supabase ?? createServiceRoleClient();
  const summary = await getAutomationDailySummary(client);

  const { data: lastRun } = await client
    .from("automation_runs")
    .select("started_at, status, actions_executed, dry_run")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lines = [
    `Automation runs today: ${summary.automationsTriggeredToday}.`,
    `Blocked workflows: ${summary.blockedWorkflows}.`,
    `Dependencies resolved today: ${summary.dependenciesResolvedToday}.`,
    `Automation failures today: ${summary.automationFailuresToday}.`,
  ];

  if (lastRun) {
    lines.push(
      `Last automation run: ${new Date(lastRun.started_at).toLocaleString()} (${lastRun.status}, ${lastRun.actions_executed} actions, dry-run: ${lastRun.dry_run}).`,
    );
  } else {
    lines.push("No automation runs recorded yet.");
  }

  return lines.join("\n");
}
