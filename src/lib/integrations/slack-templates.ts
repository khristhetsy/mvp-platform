import type { OutboundIntegrationEventType } from "@/lib/integrations/types";

export type SlackTestTemplate = {
  id: string;
  label: string;
  description: string;
  eventType: OutboundIntegrationEventType;
  title: string;
  severity: string;
  entityType: string | null;
  entityId: string | null;
  companyId: string | null;
  metadata: Record<string, unknown>;
};

const PREVIEW_ENTITY_ID = "00000000-0000-4000-8000-000000000099";

export const SLACK_TEST_TEMPLATES: SlackTestTemplate[] = [
  {
    id: "critical_compliance",
    label: "Critical compliance escalation",
    description: "Simulates a critical compliance escalation alert.",
    eventType: "compliance_critical_escalation",
    title: "Critical compliance escalation",
    severity: "critical",
    entityType: "company",
    entityId: PREVIEW_ENTITY_ID,
    companyId: PREVIEW_ENTITY_ID,
    metadata: { signal: "compliance_review_required", preview: true },
  },
  {
    id: "failed_automation",
    label: "Failed automation",
    description: "Simulates a failed workflow automation run.",
    eventType: "automation_failed",
    title: "Automation run failed",
    severity: "high",
    entityType: "automation_run",
    entityId: PREVIEW_ENTITY_ID,
    companyId: null,
    metadata: { failures_count: 1, preview: true },
  },
  {
    id: "blocked_spv_workflow",
    label: "Blocked SPV workflow",
    description: "Simulates blocked SPV workflow dependencies.",
    eventType: "workflow_blocked",
    title: "SPV workflow blocked by dependencies",
    severity: "medium",
    entityType: "spv",
    entityId: PREVIEW_ENTITY_ID,
    companyId: null,
    metadata: { unresolved_dependencies: 2, preview: true },
  },
  {
    id: "failed_import",
    label: "Failed import",
    description: "Simulates a data import failure.",
    eventType: "import_failure",
    title: "Data import failure",
    severity: "high",
    entityType: "import_job",
    entityId: PREVIEW_ENTITY_ID,
    companyId: null,
    metadata: { source: "admin_imports", preview: true },
  },
  {
    id: "overdue_action",
    label: "Overdue action",
    description: "Simulates a critical overdue workflow action.",
    eventType: "workflow_overdue",
    title: "Critical overdue workflow action",
    severity: "critical",
    entityType: "next_best_action",
    entityId: PREVIEW_ENTITY_ID,
    companyId: PREVIEW_ENTITY_ID,
    metadata: { overdue_count: 1, preview: true },
  },
];

export function getSlackTestTemplate(id: string): SlackTestTemplate | undefined {
  return SLACK_TEST_TEMPLATES.find((t) => t.id === id);
}
