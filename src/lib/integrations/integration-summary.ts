import { getIntegrationHealthSummary, listRecentDeliveryLogs } from "@/lib/integrations/health";
import { listIntegrationConnections } from "@/lib/integrations/settings";

export function isIntegrationHealthIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("integration") &&
    (lower.includes("healthy") ||
      lower.includes("slack") ||
      lower.includes("webhook") ||
      lower.includes("failed") ||
      lower.includes("active") ||
      lower.includes("delivery"))
  );
}

export async function formatIntegrationsForAssistant(message: string): Promise<string> {
  const lower = message.toLowerCase();
  const [health, connections, recent] = await Promise.all([
    getIntegrationHealthSummary(),
    listIntegrationConnections(),
    listRecentDeliveryLogs(10),
  ]);

  const active = connections.filter((c) => c.enabled);
  const slack = connections.find((c) => c.provider === "slack");
  const webhook = connections.find((c) => c.provider === "webhook");
  const failedRecent = recent.filter((r) => r.status === "failed" || r.status === "retrying");

  const lines: string[] = ["**External integrations (Phase 1)**", ""];

  if (lower.includes("healthy") || lower.includes("health")) {
    const ok =
      health.unhealthyConnections === 0 &&
      health.failedDeliveries24h === 0 &&
      health.pendingRetries === 0;
    lines.push(
      ok
        ? "Integrations appear healthy: no unhealthy connections and no failed deliveries in the last 24 hours."
        : `Integrations need attention: ${health.unhealthyConnections} unhealthy connection(s), ${health.failedDeliveries24h} failed delivery(ies) in 24h, ${health.pendingRetries} pending retry(ies).`,
    );
  }

  if (lower.includes("active") || lower.includes("what integration")) {
    lines.push(
      active.length
        ? `Active: ${active.map((c) => c.display_name || c.provider).join(", ")}.`
        : "No integrations are currently enabled.",
    );
    const placeholders = health.providers.filter((p) => p.placeholder && !p.enabled);
    if (placeholders.length) {
      lines.push(
        `Foundation placeholders (not sending): ${placeholders.map((p) => p.provider).join(", ")}.`,
      );
    }
  }

  if (lower.includes("slack")) {
    if (!slack?.enabled) {
      lines.push("Slack is not enabled. Configure it in Admin → Integrations.");
    } else if (!slack.webhookConfigured) {
      lines.push("Slack is enabled but no webhook URL is stored (encrypted at rest).");
    } else {
      const slackFails = failedRecent.filter((r) => r.provider === "slack");
      lines.push(
        slackFails.length
          ? `Slack had ${slackFails.length} recent failed delivery attempt(s). Last failure metadata is in delivery logs — webhook secrets are never shown.`
          : "Slack is enabled and no recent failed deliveries were found in the last 10 log entries.",
      );
    }
  }

  if (lower.includes("webhook") || lower.includes("failed")) {
    const webhookFails = failedRecent.filter((r) => r.provider === "webhook" || r.status === "failed");
    lines.push(
      webhookFails.length
        ? `Recent webhook issues: ${webhookFails.length} failed/retrying log(s). Open Admin → Integrations for retry.`
        : "No failed webhook deliveries in the most recent log batch.",
    );
  }

  if (lower.includes("last") && lower.includes("delivery")) {
    lines.push(
      health.lastSuccessfulDeliveryAt
        ? `Last successful delivery: ${health.lastSuccessfulDeliveryAt}.`
        : "No successful outbound delivery recorded yet.",
    );
  }

  lines.push("", "Configure and test integrations at /admin/integrations. Outbound payloads are sanitized metadata only.");

  return lines.join("\n");
}
