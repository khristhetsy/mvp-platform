"use client";

import { useMemo, useState } from "react";
import type { loadIntegrationsAdminConsole } from "@/lib/integrations/admin-console";
import { PageSection } from "@/components/ui/workspace-layout";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Payload = Awaited<ReturnType<typeof loadIntegrationsAdminConsole>>;

function deliveryStatusBadge(status: string) {
  if (status === "success") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "retrying") return "warning" as const;
  return "neutral" as const;
}

export function AdminIntegrationsConsole({
  payload,
  isAdmin,
}: Readonly<{ payload: Payload; isAdmin: boolean }>) {
  const [connections, setConnections] = useState(payload.connections);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const slack = useMemo(() => connections.find((c) => c.provider === "slack"), [connections]);
  const webhook = useMemo(() => connections.find((c) => c.provider === "webhook"), [connections]);

  const [slackUrl, setSlackUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSigning, setWebhookSigning] = useState("");

  async function patchConnection(
    provider: string,
    patch: Record<string, unknown>,
  ) {
    if (!isAdmin) return;
    setBusy(provider);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setConnections(data.connections);
      setMessage("Settings saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function testConnection(connectionId: string) {
    setBusy(connectionId);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      setMessage("Test notification queued and delivered (check delivery history).");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(null);
    }
  }

  async function retryDelivery(logId: string) {
    setBusy(logId);
    try {
      const res = await fetch("/api/admin/integrations/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryLogId: logId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Retry failed");
      setMessage("Delivery retried.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSubscription(connectionId: string, eventType: string, enabled: boolean) {
    setBusy(`${connectionId}:${eventType}`);
    try {
      const res = await fetch("/api/admin/integrations/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, eventType, enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Subscription update failed");
      }
      setMessage("Subscription updated.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Subscription update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{message}</p>
      ) : null}

      <PageSection title="Integration health">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HealthStat label="Active" value={payload.health.activeConnections} />
          <HealthStat label="Disabled" value={payload.health.disabledConnections} />
          <HealthStat label="Unhealthy" value={payload.health.unhealthyConnections} />
          <HealthStat label="Failed (24h)" value={payload.health.failedDeliveries24h} />
          <HealthStat label="Pending retries" value={payload.health.pendingRetries} />
          <HealthStat
            label="Last success"
            value={payload.health.lastSuccessfulDeliveryAt ? "Yes" : "—"}
            sub={payload.health.lastSuccessfulDeliveryAt ?? "None yet"}
          />
        </div>
      </PageSection>

      <PageSection title="Active integrations">
        <ul className="space-y-2 text-sm">
          {payload.registry.map((def) => {
            const conn = connections.find((c) => c.provider === def.provider);
            return (
              <li
                key={def.provider}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2"
              >
                <div>
                  <p className="font-medium text-slate-900">{def.label}</p>
                  <p className="text-xs text-slate-500">{def.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {def.phase1Active ? (
                    <StatusBadge label={conn?.enabled ? "Enabled" : "Disabled"} status={conn?.enabled ? "success" : "neutral"} />
                  ) : (
                    <StatusBadge label="Placeholder" status="neutral" />
                  )}
                  {conn?.webhookConfigured ? (
                    <span className="text-[10px] text-slate-500">{conn.webhookHint}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </PageSection>

      {isAdmin ? (
        <>
          <PageSection title="Slack configuration">
            {slack ? (
              <div className="space-y-3 text-sm">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Incoming webhook URL</span>
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={slack.webhookConfigured ? "Leave blank to keep existing" : "https://hooks.slack.com/…"}
                    value={slackUrl}
                    onChange={(e) => setSlackUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === "slack"}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    onClick={() =>
                      patchConnection("slack", {
                        enabled: true,
                        ...(slackUrl ? { webhook_url: slackUrl } : {}),
                      })
                    }
                  >
                    Save & enable
                  </button>
                  <button
                    type="button"
                    disabled={busy === slack.id}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                    onClick={() => testConnection(slack.id)}
                  >
                    Test notification
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                    onClick={() => patchConnection("slack", { enabled: false })}
                  >
                    Disable
                  </button>
                </div>
              </div>
            ) : null}
          </PageSection>

          <PageSection title="Webhook endpoints">
            {webhook ? (
              <div className="space-y-3 text-sm">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">HTTPS endpoint URL</span>
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={webhook.webhookConfigured ? "Leave blank to keep existing" : "https://…"}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Signing secret (optional)</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={webhookSigning}
                    onChange={(e) => setWebhookSigning(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === "webhook"}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    onClick={() =>
                      patchConnection("webhook", {
                        enabled: true,
                        ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
                        ...(webhookSigning ? { signing_secret: webhookSigning } : {}),
                      })
                    }
                  >
                    Save & enable
                  </button>
                  <button
                    type="button"
                    disabled={busy === webhook.id}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                    onClick={() => testConnection(webhook.id)}
                  >
                    Test webhook
                  </button>
                </div>
              </div>
            ) : null}
          </PageSection>

          <PageSection title="Event subscriptions">
            <p className="mb-3 text-xs text-slate-500">
              Toggle which sanitized outbound events each active connection receives. Payloads never include message bodies, documents, or secrets.
            </p>
            <div className="space-y-4">
              {[slack, webhook].filter(Boolean).map((conn) => (
                <div key={conn!.id} className="rounded-lg border border-slate-200/80 p-3">
                  <p className="text-sm font-medium text-slate-900">{conn!.display_name || conn!.provider}</p>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {payload.eventTypes.map((eventType) => {
                      const sub = payload.subscriptionsByConnection[conn!.id]?.find((s) => s.event_type === eventType);
                      const enabled = sub?.enabled ?? false;
                      return (
                        <label key={eventType} className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={!isAdmin}
                            onChange={(e) => toggleSubscription(conn!.id, eventType, e.target.checked)}
                          />
                          <span className="font-mono">{eventType}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </PageSection>
        </>
      ) : (
        <p className="text-sm text-slate-600">Analysts have read-only visibility. Admins can configure integrations.</p>
      )}

      <PageSection title="Delivery history">
        <DeliveryTable deliveries={payload.deliveries} onRetry={isAdmin ? retryDelivery : undefined} busy={busy} />
      </PageSection>

      <PageSection title="Failed deliveries">
        <DeliveryTable deliveries={payload.failedDeliveries} onRetry={isAdmin ? retryDelivery : undefined} busy={busy} />
      </PageSection>
    </div>
  );
}

function HealthStat({
  label,
  value,
  sub,
}: Readonly<{ label: string; value: string | number; sub?: string }>) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-slate-950">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-slate-500 truncate">{sub}</p> : null}
    </div>
  );
}

function DeliveryTable({
  deliveries,
  onRetry,
  busy,
}: Readonly<{
  deliveries: Payload["deliveries"];
  onRetry?: (id: string) => void;
  busy: string | null;
}>) {
  if (!deliveries.length) {
    return <p className="text-sm text-slate-600">No delivery logs yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Event</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Attempts</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {deliveries.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-3 py-2 whitespace-nowrap text-slate-600">{new Date(row.created_at).toLocaleString()}</td>
              <td className="px-3 py-2">{row.provider}</td>
              <td className="px-3 py-2 font-mono">{row.event_type}</td>
              <td className="px-3 py-2">
                <StatusBadge label={row.status} status={deliveryStatusBadge(row.status)} />
              </td>
              <td className="px-3 py-2">{row.attempt_count}</td>
              <td className="px-3 py-2">
                {onRetry && (row.status === "failed" || row.status === "retrying") ? (
                  <button
                    type="button"
                    disabled={busy === row.id}
                    className="text-[10px] font-medium text-slate-700 underline disabled:opacity-50"
                    onClick={() => onRetry(row.id)}
                  >
                    Retry
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
