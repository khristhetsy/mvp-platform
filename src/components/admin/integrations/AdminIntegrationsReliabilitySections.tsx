"use client";

import { useCallback, useState } from "react";
import type { loadIntegrationsAdminConsole } from "@/lib/integrations/admin-console";
import { healthScoreBadgeStatus } from "@/lib/integrations/health-scoring";
import { presetEnabledState } from "@/lib/integrations/subscription-presets";
import type { PayloadPreviewView } from "@/lib/integrations/payload-preview";
import { PageSection } from "@/components/ui/workspace-layout";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Payload = Awaited<ReturnType<typeof loadIntegrationsAdminConsole>>;

function formatTs(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function deliveryStatusBadge(status: string) {
  if (status === "success") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "retrying") return "warning" as const;
  if (status === "skipped") return "neutral" as const;
  return "neutral" as const;
}

export function IntegrationHealthSummarySection({ payload }: Readonly<{ payload: Payload }>) {
  const { health, healthScoring } = payload;
  return (
    <PageSection title="Integration health summary">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge
          label={`Overall: ${healthScoring.overallScore}`}
          status={healthScoreBadgeStatus(healthScoring.overallScore)}
          dot
        />
        <p className="text-xs text-slate-600">{healthScoring.overallReasons.join(" ")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HealthStat label="Active connections" value={health.activeConnections} />
        <HealthStat label="Failed (24h)" value={health.failedDeliveries24h} />
        <HealthStat label="Pending retries" value={health.pendingRetries} />
        <HealthStat label="Retry queue" value={payload.failedQueue.length} />
        <HealthStat label="Last successful delivery" value={health.lastSuccessfulDeliveryAt ? "Recorded" : "—"} sub={formatTs(health.lastSuccessfulDeliveryAt)} />
        <HealthStat label="Last failure" value={health.lastFailureAt ? "Recorded" : "—"} sub={formatTs(health.lastFailureAt)} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {healthScoring.connections.map((c) => (
          <div key={c.connectionId} className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium capitalize text-slate-900">{c.provider}</span>
              <StatusBadge label={c.score} status={healthScoreBadgeStatus(c.score)} />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">{c.reasons[0]}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              Last success: {formatTs(c.lastSuccessfulDeliveryAt)} · Failures 24h: {c.failedDeliveries24h}
            </p>
          </div>
        ))}
      </div>
    </PageSection>
  );
}

export function FailedDeliveryQueueSection({
  payload,
  isAdmin,
  onRetry,
  busy,
}: Readonly<{
  payload: Payload;
  isAdmin: boolean;
  onRetry: (id: string) => void;
  busy: string | null;
}>) {
  return (
    <PageSection title="Failed delivery queue">
      <p className="mb-3 text-xs text-slate-500">
        Failed and retrying deliveries with attempt counts and scheduled retries. Max attempts are enforced on retry.
      </p>
      {!payload.failedQueue.length ? (
        <p className="text-sm text-slate-600">No failed deliveries in the queue.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Attempts</th>
                <th className="px-3 py-2">Next retry</th>
                <th className="px-3 py-2">Error</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {payload.failedQueue.map((row) => {
                const atMax = row.attempt_count >= row.max_attempts;
                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{row.provider}</td>
                    <td className="px-3 py-2 font-mono">{row.event_type}</td>
                    <td className="px-3 py-2">
                      <StatusBadge label={row.status} status={deliveryStatusBadge(row.status)} />
                    </td>
                    <td className="px-3 py-2">
                      {row.attempt_count}/{row.max_attempts}
                      {atMax ? <span className="ml-1 text-red-600">max</span> : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatTs(row.next_retry_at)}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate text-slate-600" title={row.error_message ?? ""}>
                      {row.error_message?.slice(0, 80) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin && !atMax ? (
                        <button
                          type="button"
                          disabled={busy === row.id}
                          className="text-[10px] font-medium underline disabled:opacity-50"
                          onClick={() => onRetry(row.id)}
                        >
                          Retry
                        </button>
                      ) : isAdmin && atMax ? (
                        <span className="text-[10px] text-slate-400">Max attempts</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageSection>
  );
}

export function DeliveryTimelineSection({ payload }: Readonly<{ payload: Payload }>) {
  return (
    <PageSection title="Delivery timeline">
      <div className="space-y-2">
        {payload.timeline.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs"
          >
            <span className="text-slate-500">{formatTs(row.created_at)}</span>
            <span className="font-medium capitalize">{row.provider}</span>
            <span className="font-mono text-slate-600">{row.event_type}</span>
            <StatusBadge label={row.status} status={deliveryStatusBadge(row.status)} />
            {row.delivered_at ? (
              <span className="text-slate-500">delivered {formatTs(row.delivered_at)}</span>
            ) : null}
          </div>
        ))}
        {!payload.timeline.length ? <p className="text-sm text-slate-600">No deliveries yet.</p> : null}
      </div>
    </PageSection>
  );
}

export function SubscriptionPresetsSection({
  payload,
  isAdmin,
  slackId,
  webhookId,
  onMessage,
}: Readonly<{
  payload: Payload;
  isAdmin: boolean;
  slackId?: string;
  webhookId?: string;
  onMessage: (msg: string) => void;
}>) {
  const [busy, setBusy] = useState<string | null>(null);
  const connectionIds = [slackId, webhookId].filter(Boolean) as string[];

  async function applyPreset(connectionId: string, presetId: string, enabled: boolean) {
    if (!isAdmin) return;
    setBusy(`${connectionId}:${presetId}`);
    try {
      const res = await fetch("/api/admin/integrations/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, presetId, enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preset failed");
      onMessage(enabled ? `Preset enabled: ${presetId}` : `Preset disabled: ${presetId}`);
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Preset failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageSection title="Event subscription presets">
      <p className="mb-3 text-xs text-slate-500">
        Safe bundles of event types for compliance, automation, SPV, imports, audit, and collaboration.
      </p>
      <div className="space-y-4">
        {connectionIds.map((connectionId) => {
          const conn = payload.connections.find((c) => c.id === connectionId);
          const subs = payload.subscriptionsByConnection[connectionId] ?? [];
          return (
            <div key={connectionId} className="rounded-lg border border-slate-200/80 p-3">
              <p className="text-sm font-medium text-slate-900">{conn?.display_name || conn?.provider}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {payload.presets.map((preset) => {
                  const state = presetEnabledState(subs, preset);
                  return (
                    <div
                      key={preset.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs"
                    >
                      <p className="font-medium text-slate-800">{preset.label}</p>
                      <p className="text-[10px] text-slate-500">{preset.description}</p>
                      <div className="mt-1 flex gap-1">
                        <button
                          type="button"
                          disabled={!isAdmin || busy !== null}
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] disabled:opacity-50"
                          onClick={() => applyPreset(connectionId, preset.id, true)}
                        >
                          {state === "all" ? "All on" : "Enable all"}
                        </button>
                        <button
                          type="button"
                          disabled={!isAdmin || busy !== null}
                          className="rounded border border-slate-200 px-2 py-0.5 text-[10px] disabled:opacity-50"
                          onClick={() => applyPreset(connectionId, preset.id, false)}
                        >
                          Disable
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </PageSection>
  );
}

export function PayloadPreviewPanel({
  connectionId,
  isAdmin,
}: Readonly<{ connectionId: string; isAdmin: boolean }>) {
  const [templateId, setTemplateId] = useState("critical_compliance");
  const [preview, setPreview] = useState<PayloadPreviewView | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/integrations/preview?templateId=${encodeURIComponent(templateId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data.preview);
    } catch {
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  async function sendTest() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, templateId, previewOnly: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      alert("Test sent — check delivery timeline.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Send failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageSection title="Payload preview">
      <p className="mb-2 text-xs text-slate-500">
        Sanitized outbound shape only — no webhook URLs, secrets, message bodies, or document paths.
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
        >
          <option value="critical_compliance">Critical compliance</option>
          <option value="failed_automation">Failed automation</option>
          <option value="blocked_spv_workflow">Blocked SPV workflow</option>
          <option value="failed_import">Failed import</option>
          <option value="overdue_action">Overdue action</option>
        </select>
        <button
          type="button"
          disabled={loading}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs"
          onClick={loadPreview}
        >
          Preview payload
        </button>
        {isAdmin ? (
          <button
            type="button"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-50"
            onClick={sendTest}
          >
            Send test with template
          </button>
        ) : null}
      </div>
      {preview ? (
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-800">
          {JSON.stringify(preview, null, 2)}
        </pre>
      ) : null}
    </PageSection>
  );
}

export function SlackTestTemplatesSection({
  slackId,
  isAdmin,
  onTest,
  busy,
}: Readonly<{
  slackId?: string;
  isAdmin: boolean;
  onTest: (connectionId: string, templateId: string) => void;
  busy: string | null;
}>) {
  if (!slackId) return null;
  return (
    <PageSection title="Slack test templates">
      <p className="mb-3 text-xs text-slate-500">
        Send realistic sanitized Slack notifications for common operational scenarios.
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          { id: "critical_compliance", label: "Critical compliance" },
          { id: "failed_automation", label: "Failed automation" },
          { id: "blocked_spv_workflow", label: "Blocked SPV workflow" },
          { id: "failed_import", label: "Failed import" },
          { id: "overdue_action", label: "Overdue action" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={!isAdmin || busy === `${slackId}:${t.id}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-50"
            onClick={() => onTest(slackId, t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </PageSection>
  );
}

export function ExportDeliveriesSection({ isStaff }: Readonly<{ isStaff: boolean }>) {
  if (!isStaff) return null;
  return (
    <PageSection title="Export delivery logs">
      <p className="mb-2 text-xs text-slate-500">Staff-only export of delivery metadata (no secrets or raw payloads).</p>
      <div className="flex gap-2">
        <a
          href="/api/admin/integrations/export?format=csv"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800"
        >
          Download CSV
        </a>
        <a
          href="/api/admin/integrations/export?format=json"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800"
        >
          Download JSON
        </a>
      </div>
    </PageSection>
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
      {sub ? <p className="mt-0.5 truncate text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}
