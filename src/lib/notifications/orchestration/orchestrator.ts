import type { SupabaseClient } from "@supabase/supabase-js";
import { routeEscalationVisibility } from "@/lib/notifications/orchestration/escalation";
import { detectDormantOpportunities, detectWorkflowInactivity } from "@/lib/notifications/orchestration/inactivity";
import { deliverOrchestrationFinding } from "@/lib/notifications/orchestration/delivery";
import { ORCHESTRATION_SCAN_LIMIT } from "@/lib/notifications/orchestration/rules";
import { evaluateActionTriggers } from "@/lib/notifications/orchestration/triggers";
import type { OrchestrationFinding, OrchestrationRunResult } from "@/lib/notifications/orchestration/types";
import { markOverdueActions } from "@/lib/next-best-actions/lifecycle";
import type { NextBestActionRecord, NextBestActionRole } from "@/lib/next-best-actions/types";
import type { Database, Profile } from "@/lib/supabase/types";

const ACTIVE_STATUSES = ["open", "overdue", "blocked", "escalated", "snoozed"] as const;

async function fetchActionsForOrchestration(
  supabase: SupabaseClient<Database>,
  options?: { userId?: string; role?: NextBestActionRole },
): Promise<NextBestActionRecord[]> {
  let query = supabase
    .from("next_best_actions")
    .select("*")
    .in("status", [...ACTIVE_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(ORCHESTRATION_SCAN_LIMIT);

  if (options?.userId) query = query.eq("user_id", options.userId);
  if (options?.role) query = query.eq("role", options.role);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as NextBestActionRecord[];
}

async function processFindings(findings: OrchestrationFinding[]): Promise<OrchestrationRunResult> {
  let notificationsCreated = 0;
  let eventsEmitted = 0;
  let skippedDuplicates = 0;

  for (const finding of findings) {
    const result = await deliverOrchestrationFinding(finding);
    if (result.created) notificationsCreated += 1;
    else skippedDuplicates += 1;
    if (result.eventEmitted) eventsEmitted += 1;
  }

  return {
    scannedActions: 0,
    findings: findings.length,
    notificationsCreated,
    eventsEmitted,
    skippedDuplicates,
  };
}

export async function runNotificationOrchestration(
  supabase: SupabaseClient<Database>,
  options?: { userId?: string; role?: NextBestActionRole; includeInactivity?: boolean },
): Promise<OrchestrationRunResult> {
  const roles: NextBestActionRole[] = options?.role
    ? [options.role]
    : options?.userId
      ? []
      : ["founder", "investor", "admin", "analyst"];

  let scannedActions = 0;
  const allFindings: OrchestrationFinding[] = [];

  if (options?.userId && options?.role) {
    await markOverdueActions(supabase, options.userId, options.role);
    const rows = await fetchActionsForOrchestration(supabase, options);
    scannedActions += rows.length;
    for (const row of rows) {
      const base = evaluateActionTriggers(row);
      for (const finding of base) {
        const routed = await routeEscalationVisibility(finding, row);
        allFindings.push(...routed);
      }
    }
  } else if (options?.userId) {
    const rows = await fetchActionsForOrchestration(supabase, { userId: options.userId });
    scannedActions += rows.length;
    for (const row of rows) {
      const base = evaluateActionTriggers(row);
      allFindings.push(...base);
    }
  } else {
    for (const role of roles.length ? roles : (["founder", "investor", "admin", "analyst"] as NextBestActionRole[])) {
      const rows = await fetchActionsForOrchestration(supabase, { role });
      scannedActions += rows.length;
      for (const row of rows) {
        if (row.user_id) {
          await markOverdueActions(supabase, row.user_id, role).catch(() => undefined);
        }
        const base = evaluateActionTriggers(row);
        for (const finding of base) {
          const routed = await routeEscalationVisibility(finding, row);
          allFindings.push(...routed);
        }
      }
    }
  }

  if (options?.includeInactivity !== false && !options?.userId) {
    const inactivity = await detectWorkflowInactivity(supabase);
    const dormant = await detectDormantOpportunities(supabase);
    allFindings.push(...inactivity, ...dormant);
  }

  const result = await processFindings(allFindings);
  return { ...result, scannedActions };
}

export async function runNotificationOrchestrationForProfile(
  supabase: SupabaseClient<Database>,
  profile: Profile,
  role: NextBestActionRole,
): Promise<OrchestrationRunResult> {
  return runNotificationOrchestration(supabase, {
    userId: profile.id,
    role,
    includeInactivity: false,
  });
}
