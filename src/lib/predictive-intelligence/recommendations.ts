import type { RiskRecommendation, RiskSignal } from "@/lib/predictive-intelligence/types";

function priorityForSeverity(severity: RiskSignal["severity"]): RiskRecommendation["priority"] {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

export function buildRecommendations(signals: RiskSignal[]): RiskRecommendation[] {
  const recs: RiskRecommendation[] = [];

  for (const s of signals) {
    if (s.severity === "low" && s.entityType === "platform") continue;

    let recommendedAction = "Review entity workspace and resolve blockers.";
    if (s.type === "readiness_risk") recommendedAction = "Review readiness blockers and remediation tasks.";
    if (s.type === "spv_delay_risk") recommendedAction = "Resolve SPV investor requirements and package/closing readiness.";
    if (s.type === "compliance_risk") recommendedAction = "Triage critical/high compliance events and reduce aging backlog.";
    if (s.type === "workflow_stall_risk") recommendedAction = "Reduce overdue actions and clear stalled workflows.";
    if (s.type === "automation_failure_risk") recommendedAction = "Inspect failed automation runs and guard conditions.";
    if (s.type === "import_failure_risk") recommendedAction = "Review failed imports, fix mappings, and re-run.";
    if (s.type === "action_overdue_risk") recommendedAction = "Prioritize overdue actions by criticality.";
    if (s.type === "investor_engagement_risk") recommendedAction = "Review CRM activity funnel and publishing/marketplace visibility.";

    recs.push({
      id: `rec:${s.id}`,
      priority: priorityForSeverity(s.severity),
      title: s.title,
      explanation: s.explanation,
      recommendedAction,
      href: s.href,
      entityType: s.entityType,
      entityId: s.entityId,
      sourceSignalId: s.id,
      sourceSignalType: s.type,
      sourceData: s.sourceData,
    });
  }

  return recs.sort((a, b) => {
    const rank = (p: RiskRecommendation["priority"]) =>
      p === "critical" ? 4 : p === "high" ? 3 : p === "medium" ? 2 : 1;
    return rank(b.priority) - rank(a.priority);
  });
}

