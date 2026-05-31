import type { OperationalStatus } from "@/lib/ui/design-tokens";
import type { AdminQueueItem, AdminQueueType } from "@/lib/queues/admin-queues";

export const QUEUE_TYPE_LABELS: Record<AdminQueueType, string> = {
  company_reviews: "Pending Company Reviews",
  investor_approvals: "Investor Approval Queue",
  compliance_escalations: "Compliance Escalation Queue",
  spv_blockers: "SPV Blockers Queue",
  investor_documents: "Missing Investor Documents",
  founder_remediation: "Founder Remediation Queue",
  imports_exports: "Import / Export Review",
};

export const QUEUE_EMPTY_COPY: Record<AdminQueueType, { title: string; description: string }> = {
  company_reviews: {
    title: "No pending company reviews",
    description: "All companies are reviewed or no submissions are awaiting staff action.",
  },
  investor_approvals: {
    title: "No investor approvals pending",
    description: "Submitted investor profiles will appear here for review.",
  },
  compliance_escalations: {
    title: "No compliance escalations",
    description: "High and critical compliance events will surface here when open.",
  },
  spv_blockers: {
    title: "No SPV blockers",
    description: "Active SPVs with readiness gaps or pending requirements appear here.",
  },
  investor_documents: {
    title: "No pending investor documents",
    description: "SPV participation requirements needing review will appear here.",
  },
  founder_remediation: {
    title: "No open remediation tasks",
    description: "Founder remediation work items will appear when active.",
  },
  imports_exports: {
    title: "No imports or exports to review",
    description: "Failed imports, pending batches, and recent export activity appear here.",
  },
};

export function queueSeverityToStatus(severity: string): OperationalStatus {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "danger";
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "warning":
      return "warning";
    case "low":
      return "info";
    case "info":
      return "info";
    case "success":
      return "success";
    default:
      return "neutral";
  }
}

export function formatQueueAge(isoDate: string): string {
  const created = new Date(isoDate).getTime();
  const diffMs = Date.now() - created;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatQueueTimestamp(isoDate: string): string {
  return new Date(isoDate).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function formatQueueStatus(status: string): string {
  return status
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatQueueMetadataHint(item: AdminQueueItem): string | null {
  const meta = item.metadata;
  if (item.queue_type === "company_reviews") {
    const parts: string[] = [];
    if (typeof meta.onboarding_progress_percent === "number") {
      parts.push(`Onboarding ${meta.onboarding_progress_percent}%`);
    }
    if (typeof meta.readiness_score === "number") {
      parts.push(`Readiness ${meta.readiness_score}`);
    }
    return parts.length ? parts.join(" · ") : null;
  }
  if (item.queue_type === "spv_blockers") {
    const parts: string[] = [];
    if (typeof meta.readiness_pct === "number") parts.push(`Checklist ${meta.readiness_pct}%`);
    if (typeof meta.pending_investor_requirements === "number" && meta.pending_investor_requirements > 0) {
      parts.push(`${meta.pending_investor_requirements} pending reqs`);
    }
    if (typeof meta.blocker_label === "string") parts.push(meta.blocker_label);
    return parts.length ? parts.join(" · ") : null;
  }
  if (item.queue_type === "imports_exports" && typeof meta.failed_rows === "number" && meta.failed_rows > 0) {
    return `${meta.failed_rows} failed rows`;
  }
  if (item.queue_type === "founder_remediation" && typeof meta.priority === "string") {
    return `${formatQueueStatus(String(meta.priority))} priority`;
  }
  return null;
}

export function isAdminQueueType(value: string | undefined): value is AdminQueueType {
  return Boolean(value && value in QUEUE_TYPE_LABELS);
}
