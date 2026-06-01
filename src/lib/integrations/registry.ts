import type { IntegrationProvider, OutboundIntegrationEventType } from "@/lib/integrations/types";
import { ACTIVE_DELIVERY_PROVIDERS } from "@/lib/integrations/types";

export type ProviderDefinition = {
  provider: IntegrationProvider;
  label: string;
  description: string;
  phase1Active: boolean;
  defaultEvents: OutboundIntegrationEventType[];
};

export const INTEGRATION_REGISTRY: ProviderDefinition[] = [
  {
    provider: "slack",
    label: "Slack",
    description: "Outbound webhook notifications to a Slack channel.",
    phase1Active: true,
    defaultEvents: [
      "compliance_critical_escalation",
      "automation_failed",
      "orchestration_failed",
      "workflow_blocked",
      "workflow_overdue",
      "import_failure",
    ],
  },
  {
    provider: "webhook",
    label: "Generic webhook",
    description: "Signed HTTPS POST to your endpoint.",
    phase1Active: true,
    defaultEvents: [
      "workflow_escalated",
      "workflow_overdue",
      "automation_failed",
      "orchestration_failed",
      "digest_generated",
      "audit_export_generated",
      "collaboration_comment_created",
    ],
  },
  {
    provider: "gmail_foundation",
    label: "Gmail (foundation)",
    description: "Architecture placeholder — no outbound send in Phase 1.",
    phase1Active: false,
    defaultEvents: [],
  },
  {
    provider: "hubspot_foundation",
    label: "HubSpot (foundation)",
    description: "Architecture placeholder — no sync in Phase 1.",
    phase1Active: false,
    defaultEvents: [],
  },
  {
    provider: "docusign_foundation",
    label: "DocuSign (foundation)",
    description: "Architecture placeholder — no sync in Phase 1.",
    phase1Active: false,
    defaultEvents: [],
  },
  {
    provider: "calendar_foundation",
    label: "Calendar (foundation)",
    description: "Uses Google Calendar OAuth separately — enterprise calendar bridge placeholder.",
    phase1Active: false,
    defaultEvents: [],
  },
];

export function getProviderDefinition(provider: IntegrationProvider): ProviderDefinition | undefined {
  return INTEGRATION_REGISTRY.find((p) => p.provider === provider);
}

export function isActiveDeliveryProvider(provider: IntegrationProvider): boolean {
  return ACTIVE_DELIVERY_PROVIDERS.includes(provider);
}
