"use client";

import { useAdminActionHealthSafe } from "@/components/AdminActionHealthProvider";

function HealthRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="grid gap-1 border-b border-slate-200 py-2 last:border-b-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="break-all font-mono text-xs text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

export function AdminButtonHealthPanel() {
  const health = useAdminActionHealthSafe();

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-base font-semibold text-slate-950">System Health</h2>
          <p className="mt-1 text-sm text-slate-500">
            Admin API diagnostics and configuration status.
          </p>
        </div>
        <button
          type="button"
          disabled={health.healthCheckLoading}
          onClick={() => void health.runHealthCheck()}
          className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {health.healthCheckLoading ? "Testing..." : "Test Admin API"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
          <HealthRow label="Current user id" value={health.userId} />
          <HealthRow label="Current role" value={health.userRole} />
          <HealthRow
            label="Service role configured"
            value={health.serviceRoleConfigured ? "yes" : "no"}
          />
          <HealthRow label="Last button clicked" value={health.lastButtonClicked} />
          <HealthRow label="Last API URL" value={health.lastApiUrl} />
          <HealthRow label="Last HTTP status" value={health.lastHttpStatus} />
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
          {health.lastErrorMessage ? (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold">Last error</p>
              <p className="mt-1 whitespace-pre-wrap">{health.lastErrorMessage}</p>
            </div>
          ) : null}

          {health.healthCheckError ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Health check error</p>
              <p className="mt-1 whitespace-pre-wrap">{health.healthCheckError}</p>
            </div>
          ) : null}

          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Last response body</p>
          <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
            {health.lastResponseBody || health.healthCheckResult || "—"}
          </pre>
        </div>
      </div>
    </section>
  );
}
