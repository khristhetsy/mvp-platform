import { SLA_RULES_MS } from "@/lib/notifications/orchestration/rules";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";

export type SlaRuleKey =
  | "critical_compliance"
  | "investor_document_review"
  | "company_review"
  | "founder_remediation"
  | "investor_spv_requirement";

export function resolveSlaRuleKey(row: NextBestActionRecord): SlaRuleKey | null {
  if (row.category === "compliance" && row.priority === "critical") {
    return "critical_compliance";
  }
  if (
    row.action_type.includes("investor_documents") ||
    row.source_module === "spv_requirements" ||
    (row.category === "spv" && row.role === "investor")
  ) {
    return "investor_spv_requirement";
  }
  if (row.action_type.includes("investor_document") || row.source_module === "investor_review") {
    return "investor_document_review";
  }
  if (row.category === "admin_review" || row.action_type.includes("company_review")) {
    return "company_review";
  }
  if (row.action_type.includes("remediation") || row.category === "readiness") {
    return "founder_remediation";
  }
  return null;
}

export function slaWindowMs(rule: SlaRuleKey): number {
  switch (rule) {
    case "critical_compliance":
      return SLA_RULES_MS.criticalCompliance;
    case "investor_document_review":
      return SLA_RULES_MS.investorDocumentReview;
    case "company_review":
      return SLA_RULES_MS.companyReview;
    case "founder_remediation":
      return SLA_RULES_MS.founderRemediation;
    case "investor_spv_requirement":
      return SLA_RULES_MS.investorSpvRequirement;
    default:
      return SLA_RULES_MS.companyReview;
  }
}

export function isActionOverdue(row: Pick<NextBestActionRecord, "status" | "due_at" | "updated_at">): boolean {
  if (row.status === "overdue") return true;
  if (!row.due_at) return false;
  if (!["open", "snoozed", "blocked"].includes(row.status)) return false;
  return new Date(row.due_at).getTime() < Date.now();
}

export function isPastSlaWithoutDueAt(
  row: Pick<NextBestActionRecord, "category" | "priority" | "action_type" | "source_module" | "status" | "updated_at">,
): boolean {
  if (!["open", "blocked", "escalated"].includes(row.status)) return false;
  const rule = resolveSlaRuleKey(row as NextBestActionRecord);
  if (!rule) return false;
  const updated = new Date(row.updated_at).getTime();
  return Date.now() - updated > slaWindowMs(rule);
}

export function overdueSeverity(
  row: Pick<NextBestActionRecord, "priority" | "category">,
): "critical" | "high" | "medium" {
  if (row.priority === "critical" || row.category === "compliance") return "critical";
  if (row.priority === "high") return "high";
  return "medium";
}
