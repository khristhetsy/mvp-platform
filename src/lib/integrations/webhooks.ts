import type { IntegrationProvider, SanitizedOutboundPayload } from "@/lib/integrations/types";
import { decryptIntegrationSecret } from "@/lib/integrations/signatures";
import { signWebhookPayload } from "@/lib/integrations/signatures";

const DELIVERY_TIMEOUT_MS = 12_000;

export type WebhookDeliveryTarget = {
  provider: IntegrationProvider;
  webhookUrl: string;
  signingSecret: string | null;
};

export function resolveWebhookTarget(config: Record<string, unknown>): WebhookDeliveryTarget | null {
  const encrypted = typeof config.webhook_url_encrypted === "string" ? config.webhook_url_encrypted : null;
  if (!encrypted) return null;
  const webhookUrl = decryptIntegrationSecret(encrypted);
  if (!webhookUrl || !webhookUrl.startsWith("https://")) return null;

  let signingSecret: string | null = null;
  const encSigning = typeof config.signing_secret_encrypted === "string" ? config.signing_secret_encrypted : null;
  if (encSigning) {
    signingSecret = decryptIntegrationSecret(encSigning);
  }

  return { provider: "webhook", webhookUrl, signingSecret };
}

export function resolveSlackTarget(config: Record<string, unknown>): WebhookDeliveryTarget | null {
  const encrypted = typeof config.webhook_url_encrypted === "string" ? config.webhook_url_encrypted : null;
  if (!encrypted) return null;
  const webhookUrl = decryptIntegrationSecret(encrypted);
  if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) return null;
  return { provider: "slack", webhookUrl, signingSecret: null };
}

export function buildSlackMessage(payload: SanitizedOutboundPayload): Record<string, unknown> {
  const text = [
    `*${payload.title}*`,
    `Event: \`${payload.event_type}\``,
    `Severity: ${payload.severity}`,
    payload.entity_type ? `Entity: ${payload.entity_type}${payload.entity_id ? ` (${payload.entity_id.slice(0, 8)}…)` : ""}` : null,
    payload.company_id ? `Company: ${payload.company_id.slice(0, 8)}…` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { text };
}

export async function postWebhookDelivery(
  target: WebhookDeliveryTarget,
  payload: SanitizedOutboundPayload,
  provider: IntegrationProvider,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const body =
      provider === "slack"
        ? JSON.stringify(buildSlackMessage(payload))
        : JSON.stringify({
            event_type: payload.event_type,
            occurred_at: payload.occurred_at,
            title: payload.title,
            severity: payload.severity,
            entity_type: payload.entity_type,
            entity_id: payload.entity_id,
            company_id: payload.company_id,
            metadata: payload.metadata,
          });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "CapitalOS-Integrations/1.0",
      "X-CapitalOS-Event": payload.event_type,
    };

    if (target.signingSecret) {
      headers["X-CapitalOS-Signature"] = signWebhookPayload(body, target.signingSecret);
    }

    const res = await fetch(target.webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delivery failed";
    return { ok: false, status: 0, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
