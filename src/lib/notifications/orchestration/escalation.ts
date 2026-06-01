import type { EscalationTarget, OrchestrationFinding } from "@/lib/notifications/orchestration/types";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";
import { listStaffProfileIds } from "@/lib/notifications/notifications";

export function resolveEscalationTarget(row: NextBestActionRecord): EscalationTarget | null {
  if (row.action_type.includes("remediation") || row.category === "readiness") {
    return "admin";
  }
  if (
    row.category === "spv" &&
    (row.role === "investor" || row.action_type.includes("requirement") || row.source_module === "spv_requirements")
  ) {
    return "spv_ops";
  }
  if (row.category === "compliance" && row.priority === "critical") {
    return "admin";
  }
  if (row.category === "admin_review" || row.action_type.includes("company_review")) {
    return "admin";
  }
  return null;
}

export async function routeEscalationVisibility(
  finding: OrchestrationFinding,
  row: NextBestActionRecord,
): Promise<OrchestrationFinding[]> {
  const target = finding.escalationTarget ?? resolveEscalationTarget(row);
  if (!target || target === "founder" || target === "investor") {
    return [finding];
  }

  const staffIds = await listStaffProfileIds();
  const routed: OrchestrationFinding[] = [finding];

  for (const staffId of staffIds) {
    if (staffId === finding.recipientUserId) continue;

    routed.push({
      ...finding,
      recipientUserId: staffId,
      role: "admin",
      orchestrationType: target === "spv_ops" ? "admin_attention" : "escalation",
      dedupeKey: `${finding.dedupeKey}:staff:${staffId}`,
      title:
        target === "spv_ops"
          ? `SPV ops: ${finding.title}`
          : `Ops visibility: ${finding.title}`,
      deepLink: finding.deepLink?.startsWith("/admin") ? finding.deepLink : "/admin/actions?tab=escalated&escalated=true",
    });
  }

  return routed;
}
