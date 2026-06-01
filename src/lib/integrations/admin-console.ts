import {
  computeIntegrationHealthScoring,
  getIntegrationHealthSummary,
  listDeliveryTimeline,
  listFailedDeliveryQueue,
  listRecentDeliveryLogs,
} from "@/lib/integrations/health";
import { INTEGRATION_REGISTRY } from "@/lib/integrations/registry";
import { INTEGRATION_SUBSCRIPTION_PRESETS } from "@/lib/integrations/subscription-presets";
import { SLACK_TEST_TEMPLATES } from "@/lib/integrations/slack-templates";
import { listIntegrationConnections, listSubscriptions } from "@/lib/integrations/settings";
import { OUTBOUND_INTEGRATION_EVENTS } from "@/lib/integrations/types";

export async function loadIntegrationsAdminConsole() {
  const connections = await listIntegrationConnections();
  const [health, deliveries, failedQueue, timeline, healthScoring] = await Promise.all([
    getIntegrationHealthSummary(),
    listRecentDeliveryLogs(40),
    listFailedDeliveryQueue(30),
    listDeliveryTimeline(25),
    computeIntegrationHealthScoring(
      connections.map((c) => ({
        id: c.id,
        provider: c.provider,
        enabled: c.enabled,
        status: c.status,
        config: c.config as Record<string, unknown>,
        last_delivery_at: c.last_delivery_at,
        last_failure_at: c.last_failure_at,
        webhookConfigured: c.webhookConfigured,
      })),
    ),
  ]);

  const subscriptionsByConnection: Record<string, Awaited<ReturnType<typeof listSubscriptions>>> = {};
  for (const conn of connections) {
    subscriptionsByConnection[conn.id] = await listSubscriptions(conn.id);
  }

  return {
    registry: INTEGRATION_REGISTRY,
    eventTypes: [...OUTBOUND_INTEGRATION_EVENTS],
    presets: INTEGRATION_SUBSCRIPTION_PRESETS,
    slackTemplates: SLACK_TEST_TEMPLATES,
    connections,
    health,
    healthScoring,
    deliveries,
    failedQueue,
    timeline,
    subscriptionsByConnection,
  };
}
