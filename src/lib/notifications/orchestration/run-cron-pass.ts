import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  completeOrchestrationRun,
  startOrchestrationRun,
  type CronPassLogInput,
  type OrchestrationRunStatus,
} from "@/lib/notifications/orchestration/execution-log";
import { runNotificationOrchestration } from "@/lib/notifications/orchestration/orchestrator";
import { runBoundedAutomationPass } from "@/lib/automation/engine";
import {
  bridgeAutomationFailed,
  bridgeDigestGenerated,
  bridgeOrchestrationFailed,
  bridgeWorkflowEscalated,
  bridgeWorkflowOverdue,
} from "@/lib/integrations/emit-bridge";
import { processBoundedIntegrationRetries } from "@/lib/integrations/delivery";
import { runScheduledDigestPass } from "@/lib/notifications/scheduled/digest-scheduler";
import type { Database } from "@/lib/supabase/types";

export type CronOrchestrationResponse = {
  success: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  remindersGenerated: number;
  digestsGenerated: number;
  escalationsDetected: number;
  overdueWorkflowsDetected: number;
  orchestrationSkippedDuplicates: number;
  failuresCount: number;
  errors: Array<{ step: string; message: string }>;
  runId: string | null;
  automationsTriggered?: number;
  automationActionsCreated?: number;
};

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200);
  return "Step failed.";
}

async function countWorkflowSignals(supabase: SupabaseClient<Database>) {
  const [overdue, escalated] = await Promise.all([
    supabase
      .from("next_best_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "overdue"),
    supabase
      .from("next_best_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "escalated"),
  ]);

  return {
    overdueWorkflowsDetected: overdue.count ?? 0,
    escalationsDetected: escalated.count ?? 0,
  };
}

export async function runCronOrchestrationPass(options?: {
  triggerSource?: "cron" | "manual";
  forceDigest?: boolean;
}): Promise<CronOrchestrationResponse> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const errors: Array<{ step: string; message: string }> = [];
  const triggerSource = options?.triggerSource ?? "cron";

  const supabase = createServiceRoleClient();
  const runId = await startOrchestrationRun(supabase, triggerSource);

  let remindersGenerated = 0;
  let digestsGenerated = 0;
  let orchestrationSkippedDuplicates = 0;
  let failuresCount = 0;

  try {
    const orchestration = await runNotificationOrchestration(supabase, { includeInactivity: true });
    remindersGenerated += orchestration.notificationsCreated;
    orchestrationSkippedDuplicates = orchestration.skippedDuplicates;
  } catch (error) {
    failuresCount += 1;
    errors.push({ step: "notification_orchestration", message: safeErrorMessage(error) });
  }

  try {
    const digest = await runScheduledDigestPass(supabase, { force: options?.forceDigest ?? false });
    remindersGenerated += digest.remindersSent;
    digestsGenerated = digest.digestsGenerated;
    orchestrationSkippedDuplicates += digest.remindersSkipped;
  } catch (error) {
    failuresCount += 1;
    errors.push({ step: "scheduled_digest_pass", message: safeErrorMessage(error) });
  }

  let escalationsDetected = 0;
  let overdueWorkflowsDetected = 0;

  try {
    const signals = await countWorkflowSignals(supabase);
    escalationsDetected = signals.escalationsDetected;
    overdueWorkflowsDetected = signals.overdueWorkflowsDetected;
  } catch (error) {
    failuresCount += 1;
    errors.push({ step: "workflow_signal_count", message: safeErrorMessage(error) });
  }

  let automationsTriggered = 0;
  let automationActionsCreated = 0;
  let automationFailures = 0;
  try {
    const automation = await runBoundedAutomationPass(false);
    automationsTriggered = automation.automationsTriggered;
    automationActionsCreated = automation.actionsCreated;
    automationFailures = automation.failures;
    if (automation.failures > 0) {
      failuresCount += 1;
      errors.push({
        step: "workflow_automation",
        message: automation.errors[0]?.message ?? "Partial automation failures.",
      });
    }
  } catch (error) {
    failuresCount += 1;
    errors.push({ step: "workflow_automation", message: safeErrorMessage(error) });
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  let status: OrchestrationRunStatus = "success";
  if (failuresCount > 0 && errors.length >= 2) {
    status = "failed";
  } else if (failuresCount > 0) {
    status = "partial";
  }

  const logInput: CronPassLogInput = {
    startedAt,
    completedAt,
    durationMs,
    remindersGenerated,
    digestsGenerated,
    escalationsDetected,
    overdueDetected: overdueWorkflowsDetected,
    failuresCount,
    status,
    triggerSource,
    errors,
    orchestrationSkippedDuplicates,
  };

  await completeOrchestrationRun(supabase, runId, logInput);

  if (failuresCount > 0) {
    bridgeOrchestrationFailed(runId, failuresCount);
  }
  if (digestsGenerated > 0) {
    bridgeDigestGenerated(digestsGenerated);
  }
  if (overdueWorkflowsDetected > 0) {
    bridgeWorkflowOverdue(overdueWorkflowsDetected);
  }
  if (escalationsDetected > 0) {
    bridgeWorkflowEscalated(escalationsDetected);
  }
  if (automationFailures > 0) {
    bridgeAutomationFailed(runId, automationFailures);
  }

  try {
    await processBoundedIntegrationRetries();
  } catch {
    /* bounded retries — non-blocking */
  }

  return {
    success: status !== "failed",
    startedAt,
    completedAt,
    durationMs,
    remindersGenerated,
    digestsGenerated,
    escalationsDetected,
    overdueWorkflowsDetected,
    orchestrationSkippedDuplicates,
    failuresCount,
    errors,
    runId,
    automationsTriggered,
    automationActionsCreated,
  };
}
