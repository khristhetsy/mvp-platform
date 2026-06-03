import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { executePlannedAction } from "@/lib/automation/automation-actions";
import {
  enterAutomationDepth,
  exitAutomationDepth,
  filterGuardedActions,
  MAX_RULES_PER_PASS,
} from "@/lib/automation/automation-guards";
import {
  completeAutomationRun,
  logAutomationAction,
  startAutomationRun,
} from "@/lib/automation/automation-log";
import { countUnresolvedDependencies, resolveEntityDependencies } from "@/lib/automation/dependencies";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { sanitizeOperationalMetadata } from "@/lib/operational-activity/sanitize";
import { buildTriggerFromContext } from "@/lib/automation/triggers";
import {
  evaluateWorkflowRules,
  scanScheduledAutomationTriggers,
} from "@/lib/automation/workflows";
import type {
  AutomationEngineResult,
  AutomationRuleResult,
  AutomationTriggerContext,
} from "@/lib/automation/types";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";
import type { Database } from "@/lib/supabase/types";

const ACTIVE = ["open", "overdue", "blocked", "escalated", "snoozed"] as const;

async function fetchActiveRows(supabase: SupabaseClient<Database>, limit = 100) {
  const { data } = await supabase
    .from("next_best_actions")
    .select("*")
    .in("status", [...ACTIVE])
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NextBestActionRecord[];
}

export type RunAutomationEngineInput = {
  triggerType?: string;
  entityType?: string;
  entityId?: string;
  sourceEventId?: string;
  eventType?: string;
  companyId?: string;
  investorId?: string;
  spvId?: string;
  dryRun?: boolean;
};

export async function runAutomationEngine(
  input?: RunAutomationEngineInput,
): Promise<AutomationEngineResult> {
  if (!enterAutomationDepth()) {
    return {
      success: false,
      dryRun: input?.dryRun ?? false,
      runId: null,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      automationsTriggered: 0,
      actionsCreated: 0,
      blockersDetected: 0,
      dependenciesResolved: 0,
      skippedRules: 0,
      failures: 1,
      results: [],
      dependencies: [],
      errors: [{ step: "depth_guard", message: "Automation depth limit reached." }],
    };
  }

  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const dryRun = input?.dryRun ?? false;
  const supabase = createServiceRoleClient();

  const baseCtx: AutomationTriggerContext = buildTriggerFromContext({
    triggerType: (input?.triggerType as AutomationTriggerContext["triggerType"]) ?? "scheduled_scan",
    sourceEventId: input?.sourceEventId ?? null,
    entityType: input?.entityType ?? null,
    entityId: input?.entityId ?? null,
    companyId: input?.companyId ?? null,
    investorId: input?.investorId ?? null,
    spvId: input?.spvId ?? null,
    eventType: input?.eventType ?? null,
  });

  const runId = dryRun ? null : await startAutomationRun(supabase, {
    triggerType: baseCtx.triggerType,
    sourceEventId: baseCtx.sourceEventId,
    entityType: baseCtx.entityType,
    entityId: baseCtx.entityId,
    dryRun,
  });

  const errors: Array<{ step: string; message: string }> = [];
  const results: AutomationRuleResult[] = [];
  const executedDedupeKeys: string[] = [];
  let actionsCreated = 0;
  let skippedRules = 0;
  let failures = 0;
  let automationsTriggered = 0;

  const dependencies = baseCtx.entityType && baseCtx.entityId
    ? await resolveEntityDependencies(supabase, baseCtx.entityType, baseCtx.entityId)
    : [];

  const blockersDetected = countUnresolvedDependencies(dependencies);

  if (blockersDetected > 0 && !dryRun) {
    emitOperationalEvent(supabase, {
      eventType: "workflow_dependency_detected",
      eventCategory: "system",
      entityType: baseCtx.entityType ?? "workflow",
      entityId: baseCtx.entityId ?? null,
      companyId: baseCtx.companyId ?? null,
      title: "Workflow dependencies detected",
      description: null,
      metadata: sanitizeOperationalMetadata({ count: blockersDetected }),
      sourceModule: "workflow_automation",
      visibility: "admin_only",
      dedupeKey: `auto:deps:${baseCtx.entityType}:${baseCtx.entityId}`,
      dedupeWindowMinutes: 60,
    });
  }

  let triggers: AutomationTriggerContext[] = [baseCtx];
  if (baseCtx.triggerType === "scheduled_scan") {
    try {
      triggers = await scanScheduledAutomationTriggers(supabase);
    } catch (error) {
      errors.push({
        step: "scan_triggers",
        message: error instanceof Error ? error.message.slice(0, 200) : "Trigger scan failed.",
      });
    }
  }

  const activeRows = await fetchActiveRows(supabase);
  const allPlanned = [];

  for (const trigger of triggers.slice(0, 5)) {
    try {
      const planned = await evaluateWorkflowRules(supabase, trigger, activeRows);
      allPlanned.push(...planned);
      automationsTriggered += planned.length;
    } catch (error) {
      failures += 1;
      errors.push({
        step: `evaluate_${trigger.triggerType}`,
        message: error instanceof Error ? error.message.slice(0, 200) : "Rule evaluation failed.",
      });
    }
  }

  const { allowed, skipped } = await filterGuardedActions(supabase, allPlanned);
  skippedRules += skipped.length;

  for (const skippedId of skipped) {
    results.push({ ruleId: skippedId, status: "skipped", message: "Cooldown or dedupe guard." });
    if (runId) {
      await logAutomationAction(supabase, runId, {
        actionType: "skipped",
        status: "skipped",
        message: "Skipped by guard",
        metadata: { ruleId: skippedId },
      });
    }
  }

  for (const planned of allowed.slice(0, MAX_RULES_PER_PASS)) {
    const exec = await executePlannedAction(supabase, planned, dryRun);
    if (exec.ok) {
      actionsCreated += 1;
      executedDedupeKeys.push(planned.dedupeKey);
      results.push({
        ruleId: planned.ruleId,
        status: "executed",
        message: exec.message,
        actionType: planned.actionType,
      });
      if (!dryRun && planned.operationalEvent) {
        emitOperationalEvent(supabase, {
          eventType: planned.operationalEvent.eventType,
          eventCategory: "system",
          entityType: baseCtx.entityType ?? "workflow",
          entityId: baseCtx.entityId ?? null,
          title: planned.operationalEvent.title,
          description: null,
          metadata: sanitizeOperationalMetadata({ rule: planned.ruleId }),
          sourceModule: "workflow_automation",
          visibility: "admin_only",
          dedupeKey: planned.dedupeKey,
        });
      }
    } else {
      failures += 1;
      results.push({ ruleId: planned.ruleId, status: "failed", message: exec.message });
    }

    if (runId) {
      await logAutomationAction(supabase, runId, {
        actionType: planned.actionType,
        status: exec.ok ? "executed" : "failed",
        message: exec.message,
        dedupeKey: planned.dedupeKey,
        metadata: { ruleId: planned.ruleId },
      });
    }
  }

  const dependenciesResolved = results.filter(
    (r) => r.message.includes("resolved") || r.message.includes("unblocked"),
  ).length;

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  const engineResult: AutomationEngineResult = {
    success: failures === 0 || actionsCreated > 0,
    dryRun,
    runId,
    startedAt,
    completedAt,
    durationMs,
    automationsTriggered,
    actionsCreated,
    blockersDetected,
    dependenciesResolved,
    skippedRules,
    failures,
    results,
    dependencies,
    errors,
  };

  if (!dryRun) {
    await completeAutomationRun(supabase, runId, engineResult, executedDedupeKeys);
  }

  exitAutomationDepth();
  return engineResult;
}

/** Bounded pass for cron — no entity-specific deep scan. */
export async function runBoundedAutomationPass(dryRun = false): Promise<AutomationEngineResult> {
  return runAutomationEngine({ triggerType: "scheduled_scan", dryRun });
}
