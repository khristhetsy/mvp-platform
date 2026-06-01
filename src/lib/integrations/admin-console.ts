import { getIntegrationHealthSummary, listRecentDeliveryLogs } from "@/lib/integrations/health";
import { INTEGRATION_REGISTRY } from "@/lib/integrations/registry";
import { listIntegrationConnections, listSubscriptions } from "@/lib/integrations/settings";
import { OUTBOUND_INTEGRATION_EVENTS } from "@/lib/integrations/types";

export async function loadIntegrationsAdminConsole() {
  const [connections, health, deliveries, failedDeliveries] = await Promise.all([
    listIntegrationConnections(),
    getIntegrationHealthSummary(),
    listRecentDeliveryLogs(40),
    listRecentDeliveryLogs(20).then((rows) => rows.filter((r) => r.status === "failed" || r.status === "retrying")),
  ]);

  const subscriptionsByConnection: Record<string, Awaited<ReturnType<typeof listSubscriptions>>> = {};
  for (const conn of connections) {
    subscriptionsByConnection[conn.id] = await listSubscriptions(conn.id);
  }

  return {
    registry: INTEGRATION_REGISTRY,
    eventTypes: [...OUTBOUND_INTEGRATION_EVENTS],
    connections,
    health,
    deliveries,
    failedDeliveries,
    subscriptionsByConnection,
  };
}
