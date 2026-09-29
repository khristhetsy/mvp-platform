import { WEBHOOK_SCHEMA_VERSION, type IntegrationProvider, type SanitizedOutboundPayload } from "@/lib/integrations/types";
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

function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/+$/, "");
}

/** Slack's mrkdwn treats &, < and > as markup. */
function slackEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Slack message for an outbound event: a readable title, the fields that say
 * what happened, and a button back into iCapOS. `text` stays as the fallback
 * Slack shows in notifications.
 */
export function buildSlackMessage(payload: SanitizedOutboundPayload): Record<string, unknown> {
  const meta = payload.metadata ?? {};
  const companyName =
    payload.company_name?.trim() || (typeof meta.company_name === "string" && meta.company_name.trim() ? meta.company_name.trim() : null);
  const title = companyName && !payload.title.includes(companyName) ? `${companyName}: ${payload.title}` : payload.title;
  const url = payload.company_id ? `${appOrigin()}/admin/companies/${payload.company_id}` : `${appOrigin()}/admin`;
  const severity = payload.severity ? payload.severity.charAt(0).toUpperCase() + payload.severity.slice(1) : "Info";
  const when = new Date(payload.occurred_at);
  const whenText = Number.isNaN(when.getTime()) ? payload.occurred_at : `<!date^${Math.floor(when.getTime() / 1000)}^{date_short_pretty} {time}|${when.toISOString()}>`;

  const fields = [
    { type: "mrkdwn", text: `*Severity*\n${slackEscape(severity)}` },
    { type: "mrkdwn", text: `*When*\n${whenText}` },
    ...(companyName ? [{ type: "mrkdwn", text: `*Company*\n${slackEscape(companyName)}` }] : []),
    ...(payload.entity_type ? [{ type: "mrkdwn", text: `*Record*\n${slackEscape(payload.entity_type.replace(/_/g, " "))}` }] : []),
  ];

  return {
    text: `${title} (${severity})`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*${slackEscape(title)}*` } },
      { type: "section", fields },
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: payload.company_id ? "Open company in iCapOS" : "Open iCapOS" }, url, style: "primary" }],
      },
      { type: "context", elements: [{ type: "mrkdwn", text: `Event \`${slackEscape(payload.event_type)}\`` }] },
    ],
  };
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
            schema_version: WEBHOOK_SCHEMA_VERSION,
            event_type: payload.event_type,
            occurred_at: payload.occurred_at,
            title: payload.title,
            severity: payload.severity,
            entity_type: payload.entity_type,
            entity_id: payload.entity_id,
            company_id: payload.company_id,
            company_name: payload.company_name ?? null,
            metadata: payload.metadata,
          });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "iCapOS-Integrations/1.0",
      "X-iCapOS-Event": payload.event_type,
      "X-iCapOS-Schema-Version": String(WEBHOOK_SCHEMA_VERSION),
    };

    if (target.signingSecret) {
      headers["X-iCapOS-Signature"] = signWebhookPayload(body, target.signingSecret);
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
