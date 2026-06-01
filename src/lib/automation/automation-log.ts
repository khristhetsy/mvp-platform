import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationEngineResult, AutomationRuleResult } from "@/lib/automation/types";
import type { Database } from "@/lib/supabase/types";

export async function startAutomationRun(
  supabase: SupabaseClient<Database>,
  input: {
    triggerType?: string | null;
    sourceEventId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    dryRun: boolean;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      trigger_type: input.triggerType ?? "scheduled_scan",
      source_event_id: input.sourceEventId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      dry_run: input.dryRun,
      status: "running",
      metadata: {},
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}

export async function logAutomationAction(
  supabase: SupabaseClient<Database>,
  runId: string,
  input: {
    actionType: string;
    status: string;
    message: string;
    targetEntityType?: string | null;
    targetEntityId?: string | null;
    dedupeKey?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("automation_actions").insert({
    run_id: runId,
    action_type: input.actionType,
    status: input.status,
    target_entity_type: input.targetEntityType ?? null,
    target_entity_id: input.targetEntityId ?? null,
    message: input.message?.slice(0, 500) ?? null,
    metadata: { ...(input.metadata ?? {}), dedupe_key: input.dedupeKey },
  });
}

export async function completeAutomationRun(
  supabase: SupabaseClient<Database>,
  runId: string | null,
  result: Omit<AutomationEngineResult, "runId" | "dryRun">,
  executedDedupeKeys: string[],
) {
  if (!runId) return;

  const status =
    result.failures > 0 && result.actionsCreated === 0
      ? "failed"
      : result.failures > 0
        ? "partial"
        : "success";

  await supabase
    .from("automation_runs")
    .update({
      completed_at: result.completedAt,
      duration_ms: result.durationMs,
      actions_executed: result.actionsCreated,
      actions_skipped: result.skippedRules,
      failures_count: result.failures,
      status,
      metadata: {
        errors: result.errors,
        results: result.results,
        executed_dedupe_keys: executedDedupeKeys,
        blockers_detected: result.blockersDetected,
        dependencies_resolved: result.dependenciesResolved,
      },
    })
    .eq("id", runId);
}

export async function getAutomationDailySummary(
  supabase: SupabaseClient<Database>,
): Promise<{
  automationsTriggeredToday: number;
  blockedWorkflows: number;
  dependenciesResolvedToday: number;
  automationFailuresToday: number;
  staleChains: number;
}> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();

  const [runsToday, failedToday, resolvedEvents, blockedCount] = await Promise.all([
    supabase
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", dayStartIso),
    supabase
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", dayStartIso)
      .in("status", ["failed", "partial"]),
    supabase
      .from("operational_activity_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "workflow_dependency_resolved")
      .gte("created_at", dayStartIso),
    supabase
      .from("next_best_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "blocked"),
  ]);

  const { data: chainMeta } = await supabase
    .from("automation_runs")
    .select("metadata")
    .gte("started_at", dayStartIso)
    .limit(50);

  const staleChains = (chainMeta ?? []).filter((row) => {
    const keys = (row.metadata as { executed_dedupe_keys?: string[] })?.executed_dedupe_keys ?? [];
    return keys.length >= 8;
  }).length;

  return {
    automationsTriggeredToday: runsToday.count ?? 0,
    blockedWorkflows: blockedCount.count ?? 0,
    dependenciesResolvedToday: resolvedEvents.count ?? 0,
    automationFailuresToday: failedToday.count ?? 0,
    staleChains,
  };
}
