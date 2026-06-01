import { writeAuditLog } from "@/lib/data/audit";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export async function recordIntegrationDeliveryAudit(
  client: Client,
  params: {
    connectionId: string;
    provider: string;
    eventType: string;
    deliveryLogId: string;
    success: boolean;
    test?: boolean;
    errorMessage?: string | null;
    actorId?: string | null;
  },
): Promise<void> {
  const action = params.test
    ? "integration.test_sent"
    : params.success
      ? "integration.delivery_succeeded"
      : "integration.delivery_failed";

  if (params.actorId) {
    await writeAuditLog(client, {
      userId: params.actorId,
      action,
      entityType: "integration_connection",
      entityId: params.connectionId,
      metadata: {
        provider: params.provider,
        event_type: params.eventType,
        delivery_log_id: params.deliveryLogId,
        success: params.success,
        test: params.test ?? false,
        error: params.errorMessage ? params.errorMessage.slice(0, 200) : null,
      },
    });
  }

  emitOperationalEvent(client, {
    eventType: action,
    eventCategory: "system",
    entityType: "integration_connection",
    entityId: params.connectionId,
    actorUserId: params.actorId ?? null,
    severity: params.success ? "info" : "medium",
    title: params.test
      ? "Integration test sent"
      : params.success
        ? "Integration delivered"
        : "Integration delivery failed",
    description: params.errorMessage?.slice(0, 200) ?? null,
    metadata: {
      provider: params.provider,
      event_type: params.eventType,
      delivery_log_id: params.deliveryLogId,
    },
    sourceModule: "integrations",
    visibility: "admin_only",
    dedupeKey: params.test ? undefined : `integration:${action}:${params.deliveryLogId}`,
  });
}
