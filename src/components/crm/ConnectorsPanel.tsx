"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug, Unplug, RefreshCw, Download, ShieldCheck } from "lucide-react";

type SourceStatus = {
  id: string;
  label: string;
  configured: boolean;
  state: {
    last_full_import_at: string | null;
    last_delta_at: string | null;
    total_imported: number;
    last_error: string | null;
  } | null;
  counts: { total: number; founders: number; investors: number };
  recent: { name: string | null; module: string; email: string | null; stage: string | null; synced_at: string }[];
  test: { ok: boolean; count: number; error?: string } | null;
};

const BLUE = "#2E78F5";
const NAVY = "#0A1A40";

function rel(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ConnectorsPanel() {
  const [sources, setSources] = useState<SourceStatus[] | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ imported: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; count: number; error?: string }>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/crm/connectors");
    const json = await res.json();
    if (res.ok) setSources(json.sources ?? []);
    else setError(json.error ?? "Failed to load");
  }, []);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- initial connector status load */
    void load();
  }, [load]);

  async function runTest(sourceId: string) {
    setTesting(sourceId);
    setError(null);
    try {
      const res = await fetch("/api/admin/crm/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceId, action: "test" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Test failed");
      setTestResult((prev) => ({ ...prev, [sourceId]: json.test }));
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [sourceId]: { ok: false, count: 0, error: err instanceof Error ? err.message : "Test failed" } }));
    } finally {
      setTesting(null);
    }
  }

  async function runImport(sourceId: string) {
    setImporting(sourceId);
    setError(null);
    setProgress({ imported: 0, total: 0 });
    let restart = true;
    let running = 0;
    try {
      for (;;) {
        const res = await fetch("/api/admin/crm/connectors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: sourceId, restart }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Import failed");
        restart = false;
        running += json.imported as number;
        setProgress({ imported: json.mirrorTotal ?? running, total: json.sourceTotal ?? 0 });
        if (json.done) break;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(null);
      setProgress(null);
    }
  }

  if (!sources) {
    return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading connectors…</div>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {sources.map((s) => (
        <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold" style={{ color: NAVY }}>{s.label}</h2>
              {s.configured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <Plug className="h-3 w-3" /> {s.test?.ok ? "Connected" : "Configured"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  <Unplug className="h-3 w-3" /> Not configured
                </span>
              )}
            </div>
            {s.configured && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runTest(s.id)}
                  disabled={testing !== null || importing !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {testing === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Test connection
                </button>
                <button
                  onClick={() => runImport(s.id)}
                  disabled={importing !== null || testing !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: BLUE }}
                >
                  {importing === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {importing === s.id ? "Importing…" : "Run full import"}
                </button>
              </div>
            )}
          </div>

          {testResult[s.id] && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                testResult[s.id].ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {testResult[s.id].ok
                ? `✓ Connected — ${testResult[s.id].count.toLocaleString()} contacts visible in ${s.label}.`
                : `Connection failed: ${testResult[s.id].error ?? "unknown error"}`}
            </div>
          )}

          {!s.configured ? (
            <p className="mt-3 text-sm text-slate-500">
              Set <code className="rounded bg-slate-100 px-1 text-xs">ODOO_URL</code>,{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">ODOO_DB</code>,{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">ODOO_USERNAME</code>, and{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">ODOO_API_KEY</code> in Vercel to enable this source. Founder/investor tags are configurable via{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">ODOO_FOUNDER_TAG</code> / <code className="rounded bg-slate-100 px-1 text-xs">ODOO_INVESTOR_TAG</code>.
            </p>
          ) : (
            <>
              {s.test && !s.test.ok && s.test.error && (
                <p className="mt-3 text-xs text-rose-600">Connection error: {s.test.error}</p>
              )}

              {importing === s.id && progress && (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full" style={{ width: `${progress.total ? Math.min(100, (progress.imported / progress.total) * 100) : 10}%`, background: BLUE }} />
                    </div>
                    <span className="tabular-nums text-xs font-medium text-slate-600">
                      {progress.imported.toLocaleString()}{progress.total ? ` / ${progress.total.toLocaleString()}` : ""}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Mirrored", value: s.counts.total },
                  { label: "Founders", value: s.counts.founders },
                  { label: "Investors", value: s.counts.investors },
                ].map((c) => (
                  <div key={c.label} className="rounded-lg bg-slate-50 p-3 text-center">
                    <div className="text-lg font-semibold" style={{ color: NAVY }}>{c.value.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400">{c.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                <span><RefreshCw className="mr-1 inline h-3 w-3" />Incremental sync every 4h</span>
                <span>Last full import: {rel(s.state?.last_full_import_at ?? null)}</span>
                <span>Last sync: {rel(s.state?.last_delta_at ?? null)}</span>
                {s.state?.last_error && <span className="text-rose-600">Last error: {s.state.last_error}</span>}
              </div>

              {s.recent.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-1.5 font-semibold">Name</th>
                        <th className="px-3 py-1.5 font-semibold">Module</th>
                        <th className="px-3 py-1.5 font-semibold">Email</th>
                        <th className="px-3 py-1.5 font-semibold">Synced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.recent.map((r, i) => (
                        <tr key={i} className="border-t border-slate-50">
                          <td className="px-3 py-1.5 font-medium text-slate-800">{r.name ?? "—"}</td>
                          <td className="px-3 py-1.5 capitalize text-slate-500">{r.module}</td>
                          <td className="px-3 py-1.5 text-slate-500">{r.email ?? "—"}</td>
                          <td className="px-3 py-1.5 text-slate-400">{rel(r.synced_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#0F6E56" }} />
        Contacts are PII — mirrored server-side, admin/analyst only, never shown on public or founder/investor surfaces. Deduped on email.
      </p>
    </div>
  );
}
