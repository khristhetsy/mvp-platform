import type { AutomationTriggerContext, AutomationTriggerType } from "@/lib/automation/types";

const EVENT_TO_TRIGGER: Record<string, AutomationTriggerType> = {
  next_best_action_created: "nba_lifecycle",
  next_best_action_completed: "nba_lifecycle",
  next_best_action_escalated: "nba_lifecycle",
  next_best_action_overdue: "nba_lifecycle",
  founder_onboarding_completed: "onboarding_progress",
  import_failed: "import_failure",
  compliance_event_created: "compliance_resolution",
  spv_requirement_reviewed: "spv_requirement",
  spv_checklist_complete: "package_readiness",
  workflow_inactivity_detected: "inactivity",
  workflow_escalated: "queue_escalation",
};

export function mapOperationalEventToTrigger(eventType: string): AutomationTriggerType {
  return EVENT_TO_TRIGGER[eventType] ?? "operational_event";
}

export function buildTriggerFromContext(ctx: AutomationTriggerContext): AutomationTriggerContext {
  if (ctx.eventType && !ctx.triggerType) {
    return { ...ctx, triggerType: mapOperationalEventToTrigger(ctx.eventType) };
  }
  return ctx;
}
