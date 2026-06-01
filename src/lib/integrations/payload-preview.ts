import { buildSanitizedPayload } from "@/lib/integrations/outbound-events";
import { getSlackTestTemplate } from "@/lib/integrations/slack-templates";
import type { OutboundIntegrationEventType, SanitizedOutboundPayload } from "@/lib/integrations/types";

export type PayloadPreviewView = {
  event_type: string;
  severity: string;
  title: string;
  entity_type: string | null;
  entity_id: string | null;
  company_id: string | null;
  deep_link: string | null;
  occurred_at: string;
  source_module: string;
  metadata: Record<string, unknown>;
};

const SOURCE_MODULE_BY_EVENT: Partial<Record<OutboundIntegrationEventType, string>> = {
  compliance_critical_escalation: "compliance",
  automation_failed: "automation",
  orchestration_failed: "orchestration",
  workflow_blocked: "automation",
  workflow_overdue: "action_center",
  workflow_escalated: "action_center",
  workflow_action_created: "action_center",
  import_failure: "imports",
  audit_export_generated: "audit_compliance",
  collaboration_comment_created: "collaboration",
  digest_generated: "scheduled_digests",
};

export function resolveDeepLink(
  eventType: string,
  entityType: string | null,
  entityId: string | null,
): string | null {
  if (eventType === "compliance_critical_escalation") return "/admin/compliance";
  if (eventType === "automation_failed") return "/admin/automation";
  if (eventType === "orchestration_failed") return "/admin/dashboard";
  if (eventType === "audit_export_generated") return "/admin/audit";
  if (eventType === "import_failure") return "/admin/imports";
  if (eventType === "digest_generated") return "/admin/actions";
  if (entityType === "company" && entityId) return `/admin/companies/${entityId}`;
  if (entityType === "spv" && entityId) return `/admin/spvs`;
  if (entityType === "spv_opportunity" && entityId) return `/admin/spvs`;
  return "/admin/integrations";
}

export function payloadToPreview(payload: SanitizedOutboundPayload): PayloadPreviewView {
  const sourceModule = SOURCE_MODULE_BY_EVENT[payload.event_type] ?? "integrations";
  return {
    event_type: payload.event_type,
    severity: payload.severity,
    title: payload.title,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    company_id: payload.company_id,
    deep_link: resolveDeepLink(payload.event_type, payload.entity_type, payload.entity_id),
    occurred_at: payload.occurred_at,
    source_module: sourceModule,
    metadata: payload.metadata,
  };
}

export function buildPayloadPreviewForTemplate(templateId: string): PayloadPreviewView | null {
  const template = getSlackTestTemplate(templateId);
  if (!template) return null;
  const payload = buildSanitizedPayload({
    event_type: template.eventType,
    title: template.title,
    severity: template.severity,
    entity_type: template.entityType,
    entity_id: template.entityId,
    company_id: template.companyId,
    metadata: template.metadata,
  });
  return payloadToPreview(payload);
}

export function buildPayloadPreviewForEvent(eventType: OutboundIntegrationEventType): PayloadPreviewView {
  const payload = buildSanitizedPayload({
    event_type: eventType,
    title: `Preview: ${eventType}`,
    severity: "info",
    entity_type: "preview",
    entity_id: "00000000-0000-4000-8000-000000000001",
    metadata: { preview: true },
  });
  return payloadToPreview(payload);
}
