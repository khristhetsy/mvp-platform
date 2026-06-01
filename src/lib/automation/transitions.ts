import type { AutomationTriggerContext } from "@/lib/automation/types";

export type WorkflowTransition = {
  from: string;
  to: string;
  label: string;
};

export const COMPANY_PUBLISH_TRANSITIONS: WorkflowTransition[] = [
  { from: "draft", to: "pending_review", label: "Submit for review" },
  { from: "pending_review", to: "approved", label: "Admin approval" },
  { from: "approved", to: "published", label: "Marketplace publish" },
];

export function nextTransitionLabel(current: string, transitions: WorkflowTransition[]): string | null {
  const match = transitions.find((t) => t.from === current);
  return match?.label ?? null;
}

export function describeTransitionForContext(ctx: AutomationTriggerContext): string {
  if (ctx.triggerType === "onboarding_progress") {
    return "Onboarding progress updated — readiness and review workflows may advance.";
  }
  if (ctx.triggerType === "import_failure") {
    return "Import failure detected — remediation and admin review workflows apply.";
  }
  if (ctx.triggerType === "nba_lifecycle") {
    return "Action lifecycle changed — dependent operational follow-ups may be created.";
  }
  return "Workflow state transition evaluated.";
}
