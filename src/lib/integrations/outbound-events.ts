import type { OutboundIntegrationEventType, SanitizedOutboundPayload } from "@/lib/integrations/types";

const SENSITIVE_KEYS = new Set([
  "body",
  "message",
  "content",
  "note",
  "notes",
  "document",
  "file",
  "token",
  "secret",
  "password",
  "email",
  "oauth",
]);

export function sanitizeMetadata(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lower) || lower.includes("token") || lower.includes("secret")) continue;
    if (typeof value === "string" && value.length > 500) {
      out[key] = `${value.slice(0, 120)}…`;
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeMetadata(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function buildSanitizedPayload(params: {
  event_type: OutboundIntegrationEventType;
  title: string;
  severity?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  company_id?: string | null;
  metadata?: Record<string, unknown>;
}): SanitizedOutboundPayload {
  return {
    event_type: params.event_type,
    occurred_at: new Date().toISOString(),
    title: params.title.slice(0, 200),
    severity: params.severity ?? "info",
    entity_type: params.entity_type ?? null,
    entity_id: params.entity_id ?? null,
    company_id: params.company_id ?? null,
    metadata: sanitizeMetadata(params.metadata),
  };
}

export function eventTitleForType(eventType: OutboundIntegrationEventType): string {
  const titles: Record<OutboundIntegrationEventType, string> = {
    workflow_action_created: "Workflow action created",
    workflow_escalated: "Workflow escalated",
    workflow_overdue: "Critical overdue workflow action",
    automation_failed: "Automation run failed",
    orchestration_failed: "Notification orchestration failed",
    digest_generated: "Scheduled digest generated",
    audit_export_generated: "Audit export generated",
    collaboration_comment_created: "Collaboration comment (metadata only)",
    compliance_critical_escalation: "Critical compliance escalation",
    import_failure: "Data import failure",
    workflow_blocked: "Workflow blocked by dependencies",
  };
  return titles[eventType] ?? eventType;
}
