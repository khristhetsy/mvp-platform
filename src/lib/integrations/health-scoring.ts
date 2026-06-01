import type { IntegrationConnectionRow, IntegrationProvider } from "@/lib/integrations/types";
import { isActiveDeliveryProvider } from "@/lib/integrations/registry";

export type IntegrationHealthScore =
  | "healthy"
  | "degraded"
  | "failing"
  | "disabled"
  | "not_configured";

export type ConnectionHealthDetail = {
  connectionId: string;
  provider: IntegrationProvider;
  score: IntegrationHealthScore;
  reasons: string[];
  lastSuccessfulDeliveryAt: string | null;
  lastFailureAt: string | null;
  failedDeliveries24h: number;
  pendingRetries: number;
  webhookConfigured: boolean;
};

export type IntegrationHealthScoringResult = {
  overallScore: IntegrationHealthScore;
  overallReasons: string[];
  connections: ConnectionHealthDetail[];
};

function hasWebhookConfig(config: Record<string, unknown>): boolean {
  return Boolean(config.webhook_url_encrypted);
}

export function scoreConnectionHealth(input: {
  connection: IntegrationConnectionRow;
  webhookConfigured: boolean;
  failedDeliveries24h: number;
  pendingRetries: number;
  lastSuccessfulDeliveryAt: string | null;
}): ConnectionHealthDetail {
  const { connection } = input;
  const reasons: string[] = [];
  const config = (connection.config ?? {}) as Record<string, unknown>;
  const activeProvider = isActiveDeliveryProvider(connection.provider);

  if (!activeProvider) {
    return {
      connectionId: connection.id,
      provider: connection.provider,
      score: "disabled",
      reasons: ["Foundation placeholder — outbound delivery not active."],
      lastSuccessfulDeliveryAt: input.lastSuccessfulDeliveryAt,
      lastFailureAt: connection.last_failure_at,
      failedDeliveries24h: input.failedDeliveries24h,
      pendingRetries: input.pendingRetries,
      webhookConfigured: input.webhookConfigured,
    };
  }

  if (!connection.enabled) {
    return {
      connectionId: connection.id,
      provider: connection.provider,
      score: "disabled",
      reasons: ["Integration is disabled."],
      lastSuccessfulDeliveryAt: input.lastSuccessfulDeliveryAt,
      lastFailureAt: connection.last_failure_at,
      failedDeliveries24h: input.failedDeliveries24h,
      pendingRetries: input.pendingRetries,
      webhookConfigured: input.webhookConfigured,
    };
  }

  if (!input.webhookConfigured && !hasWebhookConfig(config)) {
    return {
      connectionId: connection.id,
      provider: connection.provider,
      score: "not_configured",
      reasons: ["Enabled but webhook URL is not configured."],
      lastSuccessfulDeliveryAt: input.lastSuccessfulDeliveryAt,
      lastFailureAt: connection.last_failure_at,
      failedDeliveries24h: input.failedDeliveries24h,
      pendingRetries: input.pendingRetries,
      webhookConfigured: false,
    };
  }

  if (connection.status === "error" || input.failedDeliveries24h >= 3) {
    if (connection.status === "error") reasons.push("Connection status is error.");
    if (input.failedDeliveries24h >= 3) reasons.push(`${input.failedDeliveries24h} failed deliveries in 24h.`);
    return {
      connectionId: connection.id,
      provider: connection.provider,
      score: "failing",
      reasons,
      lastSuccessfulDeliveryAt: input.lastSuccessfulDeliveryAt,
      lastFailureAt: connection.last_failure_at,
      failedDeliveries24h: input.failedDeliveries24h,
      pendingRetries: input.pendingRetries,
      webhookConfigured: input.webhookConfigured,
    };
  }

  if (input.pendingRetries > 0 || input.failedDeliveries24h > 0 || connection.last_failure_at) {
    if (input.pendingRetries > 0) reasons.push(`${input.pendingRetries} delivery(ies) awaiting retry.`);
    if (input.failedDeliveries24h > 0) reasons.push(`${input.failedDeliveries24h} failed in last 24h.`);
    if (connection.last_failure_at && !input.lastSuccessfulDeliveryAt) {
      reasons.push("Failure recorded with no successful delivery yet.");
    }
    return {
      connectionId: connection.id,
      provider: connection.provider,
      score: "degraded",
      reasons: reasons.length ? reasons : ["Recent delivery issues detected."],
      lastSuccessfulDeliveryAt: input.lastSuccessfulDeliveryAt,
      lastFailureAt: connection.last_failure_at,
      failedDeliveries24h: input.failedDeliveries24h,
      pendingRetries: input.pendingRetries,
      webhookConfigured: input.webhookConfigured,
    };
  }

  return {
    connectionId: connection.id,
    provider: connection.provider,
    score: "healthy",
    reasons: ["Deliveries succeeding with no retry backlog."],
    lastSuccessfulDeliveryAt: input.lastSuccessfulDeliveryAt ?? connection.last_delivery_at,
    lastFailureAt: connection.last_failure_at,
    failedDeliveries24h: 0,
    pendingRetries: 0,
    webhookConfigured: input.webhookConfigured,
  };
}

const SCORE_RANK: Record<IntegrationHealthScore, number> = {
  failing: 4,
  degraded: 3,
  not_configured: 2,
  disabled: 1,
  healthy: 0,
};

export function scoreOverallHealth(connections: ConnectionHealthDetail[]): {
  overallScore: IntegrationHealthScore;
  overallReasons: string[];
} {
  const active = connections.filter((c) => c.score !== "disabled" || c.webhookConfigured);
  if (!active.length) {
    return { overallScore: "disabled", overallReasons: ["No active integration connections."] };
  }

  const worst = active.reduce((a, b) => (SCORE_RANK[b.score] > SCORE_RANK[a.score] ? b : a));
  const failing = active.filter((c) => c.score === "failing");
  const degraded = active.filter((c) => c.score === "degraded");

  const overallReasons: string[] = [];
  if (failing.length) overallReasons.push(`${failing.length} connection(s) failing.`);
  if (degraded.length) overallReasons.push(`${degraded.length} connection(s) degraded.`);
  if (!overallReasons.length) overallReasons.push(worst.reasons[0] ?? "All monitored connections healthy.");

  return { overallScore: worst.score, overallReasons };
}

export function healthScoreBadgeStatus(
  score: IntegrationHealthScore,
): "success" | "warning" | "danger" | "neutral" {
  if (score === "healthy") return "success";
  if (score === "degraded") return "warning";
  if (score === "failing") return "danger";
  return "neutral";
}
