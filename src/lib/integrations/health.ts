import { createServiceRoleClient } from "@/lib/supabase/admin";
import { INTEGRATION_REGISTRY } from "@/lib/integrations/registry";
import type { IntegrationHealthSummary, IntegrationProvider } from "@/lib/integrations/types";

export async function getIntegrationHealthSummary(): Promise<IntegrationHealthSummary> {
  const client = createServiceRoleClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const { data: connections } = await client.from("integration_connections").select("*");

  const { count: failedCount } = await client
    .from("integration_delivery_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", since24h);

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
    providers,
  };
}

export async function listRecentDeliveryLogs(limit = 50): Promise<
  Array<{
    id: string;
    connection_id: string;
    provider: string;
    event_type: string;
    status: string;
    attempt_count: number;
    response_code: number | null;
    error_message: string | null;
    created_at: string;
    delivered_at: string | null;
  }>
> {
  const client = createServiceRoleClient();
  const { data: logs } = await client
    .from("integration_delivery_logs")
    .select("id, connection_id, event_type, status, attempt_count, response_code, error_message, created_at, delivered_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data: connections } = await client.from("integration_connections").select("id, provider");
  const providerById = new Map((connections ?? []).map((c) => [c.id, c.provider]));

  return (logs ?? []).map((row) => {
    return {
      id: row.id,
      connection_id: row.connection_id,
      provider: providerById.get(row.connection_id) ?? "unknown",
      event_type: row.event_type,
      status: row.status,
      attempt_count: row.attempt_count,
      response_code: row.response_code,
      error_message: row.error_message,
      created_at: row.created_at,
      delivered_at: row.delivered_at,
    };
  });
}
