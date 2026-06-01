import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type OrchestrationRunStatus = "running" | "success" | "partial" | "failed";

export type OrchestrationExecutionRecord = {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  reminders_generated: number;
  digests_generated: number;
  escalations_detected: number;
  overdue_detected: number;
  failures_count: number;
  status: OrchestrationRunStatus;
  trigger_source: string;
  metadata: Record<string, unknown>;
};

export type OrchestrationExecutionSummary = {
  lastRun: OrchestrationExecutionRecord | null;
  lastDigestAt: string | null;
  failedRunsToday: number;
  remindersGeneratedToday: number;
  overdueWorkflowCount: number;
};

export type CronPassLogInput = {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  remindersGenerated: number;
  digestsGenerated: number;
  escalationsDetected: number;
  overdueDetected: number;
  failuresCount: number;
  status: OrchestrationRunStatus;
  triggerSource: "cron" | "manual";
  errors: Array<{ step: string; message: string }>;
  orchestrationSkippedDuplicates?: number;
};

export async function startOrchestrationRun(
  supabase: SupabaseClient<Database>,
  triggerSource: "cron" | "manual",
): Promise<string | null> {
  const { data, error } = await supabase
    .from("orchestration_runs")
    .insert({
      status: "running",
      trigger_source: triggerSource,
      metadata: { phase: "started" },
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}

export async function completeOrchestrationRun(
  supabase: SupabaseClient<Database>,
  runId: string | null,
  input: CronPassLogInput,
): Promise<void> {
  if (!runId) return;

  await supabase
    .from("orchestration_runs")
    .update({
      completed_at: input.completedAt,
      duration_ms: input.durationMs,
      reminders_generated: input.remindersGenerated,
      digests_generated: input.digestsGenerated,
      escalations_detected: input.escalationsDetected,
      overdue_detected: input.overdueDetected,
      failures_count: input.failuresCount,
      status: input.status,
      metadata: {
        errors: input.errors,
        orchestration_skipped_duplicates: input.orchestrationSkippedDuplicates ?? 0,
      },
    })
    .eq("id", runId);
}

export async function getLatestOrchestrationRun(
  supabase: SupabaseClient<Database>,
): Promise<OrchestrationExecutionRecord | null> {
  const { data } = await supabase
    .from("orchestration_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as OrchestrationExecutionRecord | null) ?? null;
}

export async function getOrchestrationExecutionSummary(
  supabase: SupabaseClient<Database>,
): Promise<OrchestrationExecutionSummary> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();

  const [lastRun, digestRun, failedToday, overdueCount, reminderRows] = await Promise.all([
    getLatestOrchestrationRun(supabase),
    supabase
      .from("scheduled_digest_runs")
      .select("generated_at")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("orchestration_runs")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "partial"])
      .gte("started_at", dayStartIso),
    supabase
      .from("next_best_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "overdue"),
    supabase
      .from("orchestration_runs")
      .select("reminders_generated")
      .gte("started_at", dayStartIso)
      .in("status", ["success", "partial"]),
  ]);

  const remindersGeneratedToday = (reminderRows.data ?? []).reduce(
    (sum, row) => sum + (row.reminders_generated ?? 0),
    0,
  );

  return {
    lastRun,
    lastDigestAt: digestRun.data?.generated_at ?? null,
    failedRunsToday: failedToday.count ?? 0,
    remindersGeneratedToday,
    overdueWorkflowCount: overdueCount.count ?? 0,
  };
}

export async function loadAdminOrchestrationExecutionSummary(): Promise<OrchestrationExecutionSummary> {
  const supabase = createServiceRoleClient();
  return getOrchestrationExecutionSummary(supabase);
}

export function formatExecutionSummaryForAssistant(summary: OrchestrationExecutionSummary): string {
  const lines: string[] = [];
  const run = summary.lastRun;

  if (!run) {
    return "No orchestration runs have been recorded yet. Staff can trigger a manual pass from admin tools or wait for the scheduled cron job.";
  }

  lines.push(
    `Last orchestration run: ${new Date(run.started_at).toLocaleString()} (${run.status}, ${run.duration_ms ?? 0}ms).`,
  );
  lines.push(
    `Generated ${run.reminders_generated} reminder(s) and ${run.digests_generated} digest(s); detected ${run.escalations_detected} escalation(s) and ${run.overdue_detected} overdue workflow(s).`,
  );

  if (summary.lastDigestAt) {
    lines.push(`Last digest generation: ${new Date(summary.lastDigestAt).toLocaleString()}.`);
  } else {
    lines.push("No persisted digest runs found yet.");
  }

  lines.push(`Reminders generated today: ${summary.remindersGeneratedToday}.`);
  lines.push(`Overdue workflows now: ${summary.overdueWorkflowCount}.`);

  if (summary.failedRunsToday > 0) {
    lines.push(`${summary.failedRunsToday} orchestration run(s) today had failures or partial completion.`);
  } else {
    lines.push("No failed orchestration runs recorded today.");
  }

  const digestAgeHours = summary.lastDigestAt
    ? (Date.now() - new Date(summary.lastDigestAt).getTime()) / (60 * 60 * 1000)
    : null;
  if (digestAgeHours !== null && digestAgeHours <= 36) {
    lines.push("Digests appear current for the latest scheduled window.");
  } else if (summary.lastDigestAt) {
    lines.push("Digests may be stale — consider running the scheduled digest pass.");
  }

  return lines.join("\n");
}

export function isCronStatusIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("last orchestration run") ||
    lower.includes("orchestration run") ||
    lower.includes("reminders run today") ||
    lower.includes("did reminders run") ||
    lower.includes("digests current") ||
    lower.includes("are digests current") ||
    lower.includes("failed orchestration") ||
    lower.includes("cron run") ||
    lower.includes("scheduled orchestration")
  );
}
