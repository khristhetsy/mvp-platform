import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationPlannedAction } from "@/lib/automation/types";
import type { Database } from "@/lib/supabase/types";

export const MAX_AUTOMATION_DEPTH = 3;
export const AUTOMATION_COOLDOWN_MS = 15 * 60 * 1000;
export const MAX_RULES_PER_PASS = 25;

let executionDepth = 0;

export function enterAutomationDepth(): boolean {
  if (executionDepth >= MAX_AUTOMATION_DEPTH) return false;
  executionDepth += 1;
  return true;
}

export function exitAutomationDepth() {
  executionDepth = Math.max(0, executionDepth - 1);
}

export async function isAutomationOnCooldown(
  supabase: SupabaseClient<Database>,
  dedupeKey: string,
): Promise<boolean> {
  const since = new Date(Date.now() - AUTOMATION_COOLDOWN_MS).toISOString();

  const { data: metaRows } = await supabase
    .from("automation_runs")
    .select("metadata")
    .gte("started_at", since)
    .limit(30);

  return (metaRows ?? []).some((row) => {
    const keys = (row.metadata as { executed_dedupe_keys?: string[] })?.executed_dedupe_keys ?? [];
    return keys.includes(dedupeKey);
  });
}

export async function filterGuardedActions(
  supabase: SupabaseClient<Database>,
  actions: AutomationPlannedAction[],
): Promise<{ allowed: AutomationPlannedAction[]; skipped: string[] }> {
  const allowed: AutomationPlannedAction[] = [];
  const skipped: string[] = [];

  for (const action of actions.slice(0, MAX_RULES_PER_PASS)) {
    if (await isAutomationOnCooldown(supabase, action.dedupeKey)) {
      skipped.push(action.ruleId);
      continue;
    }
    allowed.push(action);
  }

  return { allowed, skipped };
}
