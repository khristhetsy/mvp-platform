export const INTEGRATION_PROVIDERS = [
  "slack",
  "gmail_foundation",
  "webhook",
  "hubspot_foundation",
  "docusign_foundation",
  "calendar_foundation",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const ACTIVE_DELIVERY_PROVIDERS: IntegrationProvider[] = ["slack", "webhook"];

export const OUTBOUND_INTEGRATION_EVENTS = [
  "workflow_action_created",
  "workflow_escalated",
  "workflow_overdue",
  "automation_failed",
  "orchestration_failed",
  "digest_generated",
  "audit_export_generated",
  "collaboration_comment_created",
  "compliance_critical_escalation",
  "import_failure",
  "workflow_blocked",
] as const;

export type OutboundIntegrationEventType = (typeof OUTBOUND_INTEGRATION_EVENTS)[number];

export type IntegrationConnectionRow = {
  id: string;
  provider: IntegrationProvider;
  display_name: string;
  status: "active" | "disabled" | "error";
  enabled: boolean;
  config: Record<string, unknown>;
  last_delivery_at: string | null;
  last_failure_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationDeliveryLogRow = {
  id: string;
  connection_id: string;
  event_type: string;
  status: "pending" | "success" | "failed" | "retrying" | "skipped";
  attempt_count: number;
  max_attempts: number;
  response_code: number | null;
  error_message: string | null;
  payload_metadata: Record<string, unknown>;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type SanitizedOutboundPayload = {
  event_type: OutboundIntegrationEventType;
  occurred_at: string;
  title: string;
  severity: string;
  entity_type: string | null;
  entity_id: string | null;
  company_id: string | null;
  metadata: Record<string, unknown>;
};

export type IntegrationHealthSummary = {
  activeConnections: number;
  disabledConnections: number;
  unhealthyConnections: number;
  failedDeliveries24h: number;
  pendingRetries: number;
  lastSuccessfulDeliveryAt: string | null;
  providers: Array<{
    provider: IntegrationProvider;
    enabled: boolean;
    status: string;
    lastDeliveryAt: string | null;
    lastFailureAt: string | null;
    placeholder: boolean;
  }>;
};
