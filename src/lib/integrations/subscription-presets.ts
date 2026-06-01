import { createServiceRoleClient } from "@/lib/supabase/admin";
import { setSubscription } from "@/lib/integrations/settings";
import type { OutboundIntegrationEventType } from "@/lib/integrations/types";

export type IntegrationSubscriptionPresetId =
  | "compliance_alerts"
  | "automation_failures"
  | "workflow_blockers"
  | "spv_operations"
  | "import_export_failures"
  | "audit_exports"
  | "collaboration_activity";

export type IntegrationSubscriptionPreset = {
  id: IntegrationSubscriptionPresetId;
  label: string;
  description: string;
  eventTypes: OutboundIntegrationEventType[];
};

export const INTEGRATION_SUBSCRIPTION_PRESETS: IntegrationSubscriptionPreset[] = [
  {
    id: "compliance_alerts",
    label: "Compliance alerts",
    description: "Critical compliance escalations and workflow escalations.",
    eventTypes: ["compliance_critical_escalation", "workflow_escalated"],
  },
  {
    id: "automation_failures",
    label: "Automation failures",
    description: "Failed automation and orchestration passes.",
    eventTypes: ["automation_failed", "orchestration_failed"],
  },
  {
    id: "workflow_blockers",
    label: "Workflow blockers",
    description: "Blocked workflows, overdue actions, and new workflow actions.",
    eventTypes: ["workflow_blocked", "workflow_overdue", "workflow_action_created"],
  },
  {
    id: "spv_operations",
    label: "SPV operations",
    description: "SPV-related workflow signals (metadata only).",
    eventTypes: ["workflow_blocked", "workflow_escalated", "workflow_overdue"],
  },
  {
    id: "import_export_failures",
    label: "Import / export failures",
    description: "Import failures and digest generation signals.",
    eventTypes: ["import_failure", "digest_generated"],
  },
  {
    id: "audit_exports",
    label: "Audit exports",
    description: "Audit export generated events.",
    eventTypes: ["audit_export_generated"],
  },
  {
    id: "collaboration_activity",
    label: "Collaboration activity",
    description: "Collaboration comment metadata (no message bodies).",
    eventTypes: ["collaboration_comment_created"],
  },
];

export function getSubscriptionPreset(id: string): IntegrationSubscriptionPreset | undefined {
  return INTEGRATION_SUBSCRIPTION_PRESETS.find((p) => p.id === id);
}

export function presetEnabledState(
  subscriptions: Array<{ event_type: string; enabled: boolean }>,
  preset: IntegrationSubscriptionPreset,
): "all" | "some" | "none" {
  const enabled = preset.eventTypes.filter((et) =>
    subscriptions.find((s) => s.event_type === et)?.enabled,
  );
  if (enabled.length === 0) return "none";
  if (enabled.length === preset.eventTypes.length) return "all";
  return "some";
}

export async function applySubscriptionPreset(
  connectionId: string,
  presetId: IntegrationSubscriptionPresetId,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const preset = getSubscriptionPreset(presetId);
  if (!preset) return { ok: false, error: "Unknown preset." };

  const client = createServiceRoleClient();
  const { data: conn } = await client
    .from("integration_connections")
    .select("id")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn) return { ok: false, error: "Connection not found." };

  for (const eventType of preset.eventTypes) {
    await setSubscription(connectionId, eventType, enabled);
  }

  return { ok: true };
}
