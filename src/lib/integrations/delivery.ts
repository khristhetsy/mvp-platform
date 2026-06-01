import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordIntegrationDeliveryAudit } from "@/lib/integrations/audit";
import { buildSanitizedPayload, eventTitleForType } from "@/lib/integrations/outbound-events";
import { computeNextRetryAt, DEFAULT_MAX_ATTEMPTS, shouldRetryDelivery } from "@/lib/integrations/retry";
import { isActiveDeliveryProvider } from "@/lib/integrations/registry";
import { ensureDefaultSubscriptions } from "@/lib/integrations/settings";
import { postWebhookDelivery, resolveSlackTarget, resolveWebhookTarget } from "@/lib/integrations/webhooks";
import type {
  IntegrationConnectionRow,
  OutboundIntegrationEventType,
  SanitizedOutboundPayload,
} from "@/lib/integrations/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const MAX_BOUNDED_DELIVERIES = 8;

function dedupeKey(connectionId: string, eventType: string, entityId: string | null): string {
  return `integration:${connectionId}:${eventType}:${entityId ?? "global"}`;
}

async function hasRecentDeliveryDedupe(
  client: SupabaseClient<Database>,
  connectionId: string,
  eventType: string,
  entityId: string | null,
): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data } = await client
    .from("integration_delivery_logs")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("event_type", eventType)
    .eq("status", "success")
    .gte("created_at", since)
    .contains("payload_metadata", { dedupe_entity_id: entityId ?? "global" })
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

function resolveTarget(connection: IntegrationConnectionRow) {
  const config = connection.config as Record<string, unknown>;
  if (connection.provider === "slack") return resolveSlackTarget(config);
  if (connection.provider === "webhook") return resolveWebhookTarget(config);
  return null;
}

export async function deliverIntegrationLog(
  logId: string,
  options?: { actorId?: string | null; force?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const client = createServiceRoleClient();
  const { data: log } = await client
    .from("integration_delivery_logs")
    .select("*")
    .eq("id", logId)
    .maybeSingle();

  if (!log) return { ok: false, error: "Delivery log not found" };

  const { data: connRow } = await client
    .from("integration_connections")
    .select("*")
    .eq("id", log.connection_id)
    .maybeSingle();
  const connection = (connRow as IntegrationConnectionRow | null) ?? null;
  if (!connection || !connection.enabled) {
    await client.from("integration_delivery_logs").update({ status: "skipped" }).eq("id", logId);
    return { ok: false, error: "Integration disabled" };
  }

  if (!isActiveDeliveryProvider(connection.provider)) {
    await client.from("integration_delivery_logs").update({ status: "skipped" }).eq("id", logId);
    return { ok: false, error: "Provider not active in Phase 1" };
  }

  const target = resolveTarget(connection);
  if (!target) {
    await client
      .from("integration_delivery_logs")
      .update({ status: "failed", error_message: "Webhook not configured", attempt_count: log.attempt_count + 1 })
      .eq("id", logId);
    return { ok: false, error: "Webhook not configured" };
  }

  const payload = log.payload_metadata as unknown as SanitizedOutboundPayload & { dedupe_entity_id?: string };
  const attempt = log.attempt_count + 1;

  const result = await postWebhookDelivery(target, payload, connection.provider);

  const now = new Date().toISOString();
  if (result.ok) {
    await client
      .from("integration_delivery_logs")
      .update({
        status: "success",
        attempt_count: attempt,
        response_code: result.status,
        delivered_at: now,
        error_message: null,
        next_retry_at: null,
      })
      .eq("id", logId);

    await client
      .from("integration_connections")
      .update({ last_delivery_at: now, status: "active", last_failure_at: connection.last_failure_at })
      .eq("id", connection.id);

    await recordIntegrationDeliveryAudit(client, {
      connectionId: connection.id,
      provider: connection.provider,
      eventType: log.event_type,
      deliveryLogId: logId,
      success: true,
      actorId: options?.actorId ?? null,
    });

    return { ok: true };
  }

  const retry = shouldRetryDelivery(attempt, log.max_attempts ?? DEFAULT_MAX_ATTEMPTS);
  const nextRetry = retry ? computeNextRetryAt(attempt).toISOString() : null;

  await client
    .from("integration_delivery_logs")
    .update({
      status: retry ? "retrying" : "failed",
      attempt_count: attempt,
      response_code: result.status || null,
      error_message: result.error?.slice(0, 500) ?? "Delivery failed",
      next_retry_at: nextRetry,
    })
    .eq("id", logId);

  await client
    .from("integration_connections")
    .update({ last_failure_at: now, status: retry ? "active" : "error" })
    .eq("id", connection.id);

  await recordIntegrationDeliveryAudit(client, {
    connectionId: connection.id,
    provider: connection.provider,
    eventType: log.event_type,
    deliveryLogId: logId,
    success: false,
    errorMessage: result.error,
    actorId: options?.actorId ?? null,
  });

  return { ok: false, error: result.error };
}

export async function emitOutboundIntegrationEvent(params: {
  event_type: OutboundIntegrationEventType;
  severity?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  company_id?: string | null;
  metadata?: Record<string, unknown>;
  skipDedupe?: boolean;
}): Promise<void> {
  const client = createServiceRoleClient();
  const payload = buildSanitizedPayload({
    event_type: params.event_type,
    title: eventTitleForType(params.event_type),
    severity: params.severity,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    company_id: params.company_id,
    metadata: params.metadata,
  });

  const { data: connections } = await client
    .from("integration_connections")
    .select("*")
    .eq("enabled", true)
    .in("provider", ["slack", "webhook"]);

  if (!connections?.length) return;

  for (const connection of connections as IntegrationConnectionRow[]) {
    if (!isActiveDeliveryProvider(connection.provider)) continue;

    const { data: sub } = await client
      .from("outbound_event_subscriptions")
      .select("enabled")
      .eq("connection_id", connection.id)
      .eq("event_type", params.event_type)
      .maybeSingle();

    if (!sub) {
      await ensureDefaultSubscriptions(connection.id, connection.provider);
      const { data: refreshed } = await client
        .from("outbound_event_subscriptions")
        .select("enabled")
        .eq("connection_id", connection.id)
        .eq("event_type", params.event_type)
        .maybeSingle();
      if (!refreshed?.enabled) continue;
    } else if (!sub.enabled) {
      continue;
    }

    if (!params.skipDedupe) {
      const dup = await hasRecentDeliveryDedupe(client, connection.id, params.event_type, params.entity_id ?? null);
      if (dup) continue;
    }

    const logPayload = {
      ...payload,
      dedupe_entity_id: params.entity_id ?? "global",
      dedupe_key: dedupeKey(connection.id, params.event_type, params.entity_id ?? null),
    };

    const { data: inserted } = await client
      .from("integration_delivery_logs")
      .insert({
        connection_id: connection.id,
        event_type: params.event_type,
        status: "pending",
        payload_metadata: logPayload,
        max_attempts: DEFAULT_MAX_ATTEMPTS,
      })
      .select("id")
      .single();

    if (inserted?.id) {
      await deliverIntegrationLog(inserted.id);
    }
  }
}

export async function processBoundedIntegrationRetries(): Promise<{ processed: number }> {
  const client = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data: pending } = await client
    .from("integration_delivery_logs")
    .select("id")
    .in("status", ["failed", "retrying"])
    .lte("next_retry_at", now)
    .order("next_retry_at", { ascending: true })
    .limit(MAX_BOUNDED_DELIVERIES);

  let processed = 0;
  for (const row of pending ?? []) {
    await deliverIntegrationLog(row.id);
    processed += 1;
  }
  return { processed };
}

export async function sendIntegrationTest(
  connectionId: string,
  actorId: string,
): Promise<{ ok: boolean; error?: string; logId?: string }> {
  const client = createServiceRoleClient();
  const { data: connection } = await client
    .from("integration_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();

  if (!connection) return { ok: false, error: "Connection not found" };
  const row = connection as IntegrationConnectionRow;
  if (!isActiveDeliveryProvider(row.provider)) {
    return { ok: false, error: "Test delivery not available for placeholder providers." };
  }

  const payload = buildSanitizedPayload({
    event_type: "workflow_action_created",
    title: "CapitalOS integration test",
    severity: "info",
    metadata: { test: true },
  });

  const { data: inserted } = await client
    .from("integration_delivery_logs")
    .insert({
      connection_id: connectionId,
      event_type: "integration_test",
      status: "pending",
      payload_metadata: payload,
      max_attempts: 1,
    })
    .select("id")
    .single();

  if (!inserted?.id) return { ok: false, error: "Could not create delivery log" };

  const result = await deliverIntegrationLog(inserted.id, { actorId, force: true });

  await recordIntegrationDeliveryAudit(client, {
    connectionId,
    provider: row.provider,
    eventType: "integration_test",
    deliveryLogId: inserted.id,
    success: result.ok,
    test: true,
    actorId,
    errorMessage: result.error,
  });

  return { ...result, logId: inserted.id };
}
