import {
  computeIntegrationHealthScoring,
  getIntegrationHealthSummary,
  listFailedDeliveryQueue,
  listRecentDeliveryLogs,
} from "@/lib/integrations/health";
import { listIntegrationConnections, listSubscriptions } from "@/lib/integrations/settings";
import { INTEGRATION_SUBSCRIPTION_PRESETS } from "@/lib/integrations/subscription-presets";

export function isIntegrationHealthIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("integration") ||
    (lower.includes("slack") && (lower.includes("fail") || lower.includes("delivery") || lower.includes("webhook"))) ||
    (lower.includes("webhook") && (lower.includes("fail") || lower.includes("show")))
  );
}

export async function formatIntegrationsForAssistant(message: string): Promise<string> {
  const lower = message.toLowerCase();
  const [health, connections, recent, failedQueue] = await Promise.all([
    getIntegrationHealthSummary(),
    listIntegrationConnections(),
    listRecentDeliveryLogs(15),
    listFailedDeliveryQueue(10),
  ]);

  const scoring = await computeIntegrationHealthScoring(
    connections
      .filter((c) => c.provider === "slack" || c.provider === "webhook")
      .map((c) => ({
        id: c.id,
        provider: c.provider,
        enabled: c.enabled,
        status: c.status,
        config: c.config as Record<string, unknown>,
        last_delivery_at: c.last_delivery_at,
        last_failure_at: c.last_failure_at,
        webhookConfigured: c.webhookConfigured,
      })),
  );

  const active = connections.filter((c) => c.enabled);
  const slack = connections.find((c) => c.provider === "slack");
  const failing = scoring.connections.filter((c) => c.score === "failing" || c.score === "degraded");

  const lines: string[] = ["**External integrations**", ""];

  if (
    lower.includes("failing") ||
    lower.includes("which integration") ||
    lower.includes("show failed")
  ) {
    if (failing.length) {
      lines.push(
        `Connections needing attention: ${failing.map((f) => `${f.provider} (${f.score}: ${f.reasons[0]})`).join("; ")}.`,
      );
    } else {
      lines.push("No Slack or webhook connections are currently in failing or degraded state.");
    }
    if (failedQueue.length) {
      lines.push(
        `Failed delivery queue (${failedQueue.length}): ${failedQueue
          .slice(0, 5)
          .map((r) => `${r.provider}/${r.event_type} — ${r.error_message?.slice(0, 60) ?? r.status}`)
          .join("; ")}.`,
      );
    }
  }

  if (lower.includes("subscribed") || lower.includes("subscription") || lower.includes("what events")) {
    for (const conn of active.filter((c) => c.provider === "slack" || c.provider === "webhook")) {
      const subs = await listSubscriptions(conn.id);
      const enabled = subs.filter((s) => s.enabled).map((s) => s.event_type);
      lines.push(
        `${conn.provider}: ${enabled.length ? enabled.join(", ") : "no event subscriptions enabled yet"}.`,
      );
    }
    lines.push(`Presets available: ${INTEGRATION_SUBSCRIPTION_PRESETS.map((p) => p.label).join(", ")}.`);
  }

  if (lower.includes("healthy") || lower.includes("health") || lower.includes("okay")) {
    lines.push(
      `Overall health: **${scoring.overallScore}**. ${scoring.overallReasons.join(" ")}`,
      `Failed deliveries (24h): ${health.failedDeliveries24h}. Pending retries: ${health.pendingRetries}.`,
    );
  }

  if (lower.includes("slack")) {
    if (!slack?.enabled) {
      lines.push("Slack is not enabled.");
    } else if (!slack.webhookConfigured) {
      lines.push("Slack is enabled but webhook is not configured.");
    } else {
      const slackScore = scoring.connections.find((c) => c.provider === "slack");
      const slackFails = recent.filter((r) => r.provider === "slack" && (r.status === "failed" || r.status === "retrying"));
      if (lower.includes("why") && lower.includes("fail")) {
        lines.push(
          slackFails.length
            ? `Recent Slack failures: ${slackFails.map((r) => r.error_message?.slice(0, 100) ?? "unknown error").join("; ")}. Secrets are never exposed — check delivery logs in Admin → Integrations.`
            : "No recent Slack failures in the latest delivery batch.",
        );
      } else {
        lines.push(`Slack health: ${slackScore?.score ?? "unknown"}. ${slackScore?.reasons[0] ?? ""}`);
      }
    }
  }

  if (lower.includes("webhook") && (lower.includes("fail") || lower.includes("show"))) {
    const webhookFails = failedQueue.filter((r) => r.provider === "webhook");
    lines.push(
      webhookFails.length
        ? `${webhookFails.length} failed webhook delivery(ies) in queue. Use Admin → Integrations to retry (respects max attempts).`
        : "No failed webhooks in the current queue.",
    );
  }

  if (lower.includes("active") || lower.includes("what integration")) {
    lines.push(
      active.length
        ? `Active: ${active.map((c) => c.display_name || c.provider).join(", ")}.`
        : "No integrations enabled.",
    );
  }

  if (lower.includes("last") && lower.includes("delivery")) {
    lines.push(
      health.lastSuccessfulDeliveryAt
        ? `Last successful delivery: ${health.lastSuccessfulDeliveryAt}.`
        : "No successful delivery recorded yet.",
    );
    if (health.lastFailureAt) {
      lines.push(`Last failure timestamp: ${health.lastFailureAt}.`);
    }
  }

  lines.push("", "Manage at /admin/integrations — sanitized metadata only in outbound payloads.");

  return lines.join("\n");
}
