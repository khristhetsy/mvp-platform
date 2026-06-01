import type { OrchestrationDigest, OrchestrationDigestItem } from "@/lib/notifications/orchestration/types";
import type { NextBestActionRecord } from "@/lib/next-best-actions/types";
import { isActionOverdue } from "@/lib/notifications/orchestration/due-dates";
import { actionCenterBasePath } from "@/lib/actions/filters";

function toDigestItem(row: NextBestActionRecord, orchestrationType: OrchestrationDigestItem["orchestrationType"]): OrchestrationDigestItem {
  return {
    id: row.id,
    title: row.title,
    severity: row.priority === "critical" ? "critical" : row.priority === "high" ? "high" : "medium",
    orchestrationType,
    deepLink: row.href ?? actionCenterBasePath(row.role),
    trigger: undefined,
  };
}

export function buildRoleDigest(
  role: NextBestActionRecord["role"],
  rows: NextBestActionRecord[],
): OrchestrationDigest {
  const active = rows.filter((r) => ["open", "overdue", "blocked", "escalated"].includes(r.status));

  const critical = active
    .filter((r) => r.priority === "critical")
    .slice(0, 10)
    .map((r) => toDigestItem(r, "admin_attention"));

  const overdue = active
    .filter((r) => isActionOverdue(r))
    .slice(0, 10)
    .map((r) => toDigestItem(r, "overdue"));

  const escalated = active
    .filter((r) => r.status === "escalated")
    .slice(0, 10)
    .map((r) => toDigestItem(r, "escalation"));

  const blocked = active
    .filter((r) => r.status === "blocked")
    .slice(0, 10)
    .map((r) => toDigestItem(r, "workflow_blocked"));

  const recommendedNext = active
    .filter((r) => !isActionOverdue(r) && r.status === "open")
    .slice(0, 8)
    .map((r) => toDigestItem(r, "reminder"));

  return {
    role,
    generatedAt: new Date().toISOString(),
    critical,
    overdue,
    escalated,
    blocked,
    recommendedNext,
  };
}

export function buildFounderDigest(rows: NextBestActionRecord[]): OrchestrationDigest {
  return buildRoleDigest("founder", rows);
}

export function buildInvestorDigest(rows: NextBestActionRecord[]): OrchestrationDigest {
  return buildRoleDigest("investor", rows);
}

export function buildAdminDigest(rows: NextBestActionRecord[]): OrchestrationDigest {
  return buildRoleDigest("admin", rows);
}

export function formatDigestForAssistant(digest: OrchestrationDigest): string {
  const lines: string[] = [];
  if (digest.critical.length) {
    lines.push(`Critical (${digest.critical.length}): ${digest.critical.map((i) => i.title).join("; ")}`);
  }
  if (digest.overdue.length) {
    lines.push(`Overdue (${digest.overdue.length}): ${digest.overdue.map((i) => i.title).join("; ")}`);
  }
  if (digest.blocked.length) {
    lines.push(`Blocked (${digest.blocked.length}): ${digest.blocked.map((i) => i.title).join("; ")}`);
  }
  if (digest.escalated.length) {
    lines.push(`Escalated (${digest.escalated.length}): ${digest.escalated.map((i) => i.title).join("; ")}`);
  }
  return lines.length ? lines.join("\n") : "No orchestration items in the current digest window.";
}
