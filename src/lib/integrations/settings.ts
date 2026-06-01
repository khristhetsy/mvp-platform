import { createServiceRoleClient } from "@/lib/supabase/admin";
import { encryptIntegrationSecret, maskSecretHint } from "@/lib/integrations/signatures";
import { getProviderDefinition, isActiveDeliveryProvider } from "@/lib/integrations/registry";
import type {
  IntegrationConnectionRow,
  IntegrationProvider,
  OutboundIntegrationEventType,
} from "@/lib/integrations/types";
import { OUTBOUND_INTEGRATION_EVENTS } from "@/lib/integrations/types";

export type IntegrationConnectionView = Omit<IntegrationConnectionRow, "config"> & {
  config: Record<string, unknown>;
  webhookConfigured: boolean;
  webhookHint: string;
};

function toView(row: IntegrationConnectionRow): IntegrationConnectionView {
  const config = (row.config ?? {}) as Record<string, unknown>;
  const hasWebhook = Boolean(config.webhook_url_encrypted);
  return {
    ...row,
    config: {
      ...config,
      webhook_url_encrypted: undefined,
      signing_secret_encrypted: undefined,
    },
    webhookConfigured: hasWebhook,
    webhookHint: maskSecretHint(hasWebhook ? "configured" : null),
  };
}

export async function ensureIntegrationConnections(): Promise<void> {
  const client = createServiceRoleClient();
  for (const def of [
    "slack",
    "webhook",
    "gmail_foundation",
    "hubspot_foundation",
    "docusign_foundation",
    "calendar_foundation",
  ] as IntegrationProvider[]) {
    const { data: existing } = await client
      .from("integration_connections")
      .select("id")
      .eq("provider", def)
      .maybeSingle();

    if (existing) continue;

    const providerDef = getProviderDefinition(def);
    await client.from("integration_connections").insert({
      provider: def,
      display_name: providerDef?.label ?? def,
      status: "disabled",
      enabled: false,
      config: {},
    });
  }
}

export async function listIntegrationConnections(): Promise<IntegrationConnectionView[]> {
  await ensureIntegrationConnections();
  const client = createServiceRoleClient();
  const { data, error } = await client
    .from("integration_connections")
    .select("*")
    .order("provider");

  if (error || !data) return [];
  return (data as IntegrationConnectionRow[]).map(toView);
}

export async function getIntegrationConnection(
  provider: IntegrationProvider,
): Promise<IntegrationConnectionRow | null> {
  const client = createServiceRoleClient();
  const { data } = await client
    .from("integration_connections")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();
  return (data as IntegrationConnectionRow | null) ?? null;
}

export async function updateIntegrationConnection(
  provider: IntegrationProvider,
  patch: {
    enabled?: boolean;
    display_name?: string;
    webhook_url?: string | null;
    signing_secret?: string | null;
    actorId?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!isActiveDeliveryProvider(provider) && (patch.webhook_url || patch.enabled)) {
    const def = getProviderDefinition(provider);
    if (!def?.phase1Active) {
      return { ok: false, error: "Provider is a Phase 1 placeholder — enable only after activation." };
    }
  }

  const client = createServiceRoleClient();
  const existing = await getIntegrationConnection(provider);
  if (!existing) return { ok: false, error: "Connection not found" };

  const config = { ...(existing.config as Record<string, unknown>) };

  if (patch.webhook_url !== undefined) {
    if (patch.webhook_url === null || patch.webhook_url === "") {
      delete config.webhook_url_encrypted;
    } else {
      const encrypted = encryptIntegrationSecret(patch.webhook_url.trim());
      if (!encrypted) {
        return { ok: false, error: "TOKEN_ENCRYPTION_SECRET must be set (32+ chars) to store webhooks." };
      }
      if (provider === "slack" && !patch.webhook_url.startsWith("https://hooks.slack.com/")) {
        return { ok: false, error: "Slack webhook URL must start with https://hooks.slack.com/" };
      }
      if (provider === "webhook" && !patch.webhook_url.startsWith("https://")) {
        return { ok: false, error: "Webhook URL must use HTTPS." };
      }
      config.webhook_url_encrypted = encrypted;
    }
  }

  if (patch.signing_secret !== undefined) {
    if (!patch.signing_secret) {
      delete config.signing_secret_encrypted;
    } else {
      const enc = encryptIntegrationSecret(patch.signing_secret);
      if (!enc) return { ok: false, error: "Cannot encrypt signing secret." };
      config.signing_secret_encrypted = enc;
    }
  }

  const enabled = patch.enabled ?? existing.enabled;
  const status = enabled ? "active" : "disabled";

  const { error } = await client
    .from("integration_connections")
    .update({
      enabled,
      status,
      display_name: patch.display_name ?? existing.display_name,
      config,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listSubscriptions(connectionId: string): Promise<
  Array<{ id: string; event_type: string; enabled: boolean }>
> {
  const client = createServiceRoleClient();
  const { data } = await client
    .from("outbound_event_subscriptions")
    .select("id, event_type, enabled")
    .eq("connection_id", connectionId);
  return data ?? [];
}

export async function setSubscription(
  connectionId: string,
  eventType: OutboundIntegrationEventType,
  enabled: boolean,
): Promise<void> {
  const client = createServiceRoleClient();
  if (!OUTBOUND_INTEGRATION_EVENTS.includes(eventType)) return;

  const { data: existing } = await client
    .from("outbound_event_subscriptions")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("event_type", eventType)
    .maybeSingle();

  if (existing) {
    await client.from("outbound_event_subscriptions").update({ enabled }).eq("id", existing.id);
  } else {
    await client.from("outbound_event_subscriptions").insert({
      connection_id: connectionId,
      event_type: eventType,
      enabled,
    });
  }
}

export async function ensureDefaultSubscriptions(connectionId: string, provider: IntegrationProvider): Promise<void> {
  const def = getProviderDefinition(provider);
  if (!def) return;
  for (const event of def.defaultEvents) {
    await setSubscription(connectionId, event, true);
  }
}
