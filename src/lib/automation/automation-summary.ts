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
