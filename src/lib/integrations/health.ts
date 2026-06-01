import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  scoreConnectionHealth,
  scoreOverallHealth,
  type IntegrationHealthScoringResult,
} from "@/lib/integrations/health-scoring";
import { INTEGRATION_REGISTRY } from "@/lib/integrations/registry";
import type { IntegrationConnectionRow, IntegrationHealthSummary, IntegrationProvider } from "@/lib/integrations/types";

export type IntegrationDeliveryLogView = {
  id: string;
  connection_id: string;
  provider: string;
  event_type: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  response_code: number | null;
  error_message: string | null;
  next_retry_at: string | null;
  created_at: string;
  delivered_at: string | null;
};

const since24h = () => new Date(Date.now() - 24 * 60 * 60_000).toISOString();

async function deliveryStatsForConnection(connectionId: string) {
  const client = createServiceRoleClient();
  const { count: failedCount } = await client
    .from("integration_delivery_logs")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .eq("status", "failed")
    .gte("created_at", since24h());

  const { count: retryCount } = await client
    .from("integration_delivery_logs")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .in("status", ["retrying", "failed"])
    .not("next_retry_at", "is", null);

  const { data: lastSuccess } = await client
    .from("integration_delivery_logs")
    .select("delivered_at")
    .eq("connection_id", connectionId)
    .eq("status", "success")
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    failedDeliveries24h: failedCount ?? 0,
    pendingRetries: retryCount ?? 0,
    lastSuccessfulDeliveryAt: lastSuccess?.delivered_at ?? null,
  };
}

function mapLogRow(
  row: {
    id: string;
    connection_id: string;
    event_type: string;
    status: string;
    attempt_count: number;
    max_attempts: number;
    response_code: number | null;
    error_message: string | null;
    next_retry_at: string | null;
    created_at: string;
    delivered_at: string | null;
  },
  providerById: Map<string, string>,
): IntegrationDeliveryLogView {
  return {
    id: row.id,
    connection_id: row.connection_id,
    provider: providerById.get(row.connection_id) ?? "unknown",
    event_type: row.event_type,
    status: row.status,
    attempt_count: row.attempt_count,
    max_attempts: row.max_attempts,
    response_code: row.response_code,
    error_message: row.error_message,
    next_retry_at: row.next_retry_at,
    created_at: row.created_at,
    delivered_at: row.delivered_at,
  };
}

async function providerMap() {
  const client = createServiceRoleClient();
  const { data: connections } = await client.from("integration_connections").select("id, provider");
  return new Map((connections ?? []).map((c) => [c.id, c.provider]));
}

export async function getIntegrationHealthSummary(): Promise<IntegrationHealthSummary> {
  const client = createServiceRoleClient();
  const { data: connections } = await client.from("integration_connections").select("*");

  const { count: failedCount } = await client
    .from("integration_delivery_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", since24h());

  const { count: retryCount } = await client
    .from("integration_delivery_logs")
    .select("id", { count: "exact", head: true })
    .in("status", ["retrying", "failed"])
    .not("next_retry_at", "is", null);

  const { data: lastSuccess } = await client
    .from("integration_delivery_logs")
    .select("delivered_at")
    .eq("status", "success")
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lastFailure } = await client
    .from("integration_delivery_logs")
    .select("created_at")
    .in("status", ["failed", "retrying"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rows = connections ?? [];
  const active = rows.filter((c) => c.enabled && c.status === "active");
  const disabled = rows.filter((c) => !c.enabled);
  const unhealthy = rows.filter((c) => c.status === "error" || (c.enabled && c.last_failure_at && !c.last_delivery_at));

  const providers = INTEGRATION_REGISTRY.map((def) => {
    const row = rows.find((c) => c.provider === def.provider);
    return {
      provider: def.provider as IntegrationProvider,
      enabled: row?.enabled ?? false,
      status: row?.status ?? "disabled",
      lastDeliveryAt: row?.last_delivery_at ?? null,
      lastFailureAt: row?.last_failure_at ?? null,
      placeholder: !def.phase1Active,
    };
  });

  return {
    activeConnections: active.length,
    disabledConnections: disabled.length,
    unhealthyConnections: unhealthy.length,
    failedDeliveries24h: failedCount ?? 0,
    pendingRetries: retryCount ?? 0,
    lastSuccessfulDeliveryAt: lastSuccess?.delivered_at ?? null,
    lastFailureAt: lastFailure?.created_at ?? null,
    providers,
  };
}

export async function computeIntegrationHealthScoring(
  connections: Array<{
    id: string;
    provider: IntegrationProvider;
    enabled: boolean;
    status: string;
    config: Record<string, unknown>;
    last_delivery_at: string | null;
    last_failure_at: string | null;
    webhookConfigured: boolean;
  }>,
): Promise<IntegrationHealthScoringResult> {
  const details = await Promise.all(
    connections
      .filter((c) => c.provider === "slack" || c.provider === "webhook")
      .map(async (c) => {
        const stats = await deliveryStatsForConnection(c.id);
        return scoreConnectionHealth({
          connection: {
            id: c.id,
            provider: c.provider,
            display_name: "",
            status: c.status as IntegrationConnectionRow["status"],
            enabled: c.enabled,
            config: c.config,
            last_delivery_at: c.last_delivery_at,
            last_failure_at: c.last_failure_at,
            created_by: null,
            created_at: "",
            updated_at: "",
          },
          webhookConfigured: c.webhookConfigured,
          ...stats,
        });
      }),
  );

  const { overallScore, overallReasons } = scoreOverallHealth(details);
  return { overallScore, overallReasons, connections: details };
}

export async function listRecentDeliveryLogs(limit = 50): Promise<IntegrationDeliveryLogView[]> {
  const client = createServiceRoleClient();
  const providerById = await providerMap();
  const { data: logs } = await client
    .from("integration_delivery_logs")
    .select(
      "id, connection_id, event_type, status, attempt_count, max_attempts, response_code, error_message, next_retry_at, created_at, delivered_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return (logs ?? []).map((row) => mapLogRow(row, providerById));
}

export async function listFailedDeliveryQueue(limit = 30): Promise<IntegrationDeliveryLogView[]> {
  const client = createServiceRoleClient();
  const providerById = await providerMap();
  const { data: logs } = await client
    .from("integration_delivery_logs")
    .select(
      "id, connection_id, event_type, status, attempt_count, max_attempts, response_code, error_message, next_retry_at, created_at, delivered_at",
    )
    .in("status", ["failed", "retrying"])
    .order("next_retry_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return (logs ?? []).map((row) => mapLogRow(row, providerById));
}

export async function listDeliveryTimeline(limit = 25): Promise<IntegrationDeliveryLogView[]> {
  return listRecentDeliveryLogs(limit);
}
