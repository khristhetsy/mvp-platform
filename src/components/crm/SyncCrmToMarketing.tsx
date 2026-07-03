"use client";

import { useState } from "react";
import { Loader2, Megaphone, Check } from "lucide-react";

const BLUE = "#2E78F5";

export function SyncCrmToMarketing() {
  const [running, setRunning] = useState(false);
  const [synced, setSynced] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true); setError(null); setSynced(0); setDone(false);
    let offset = 0;
    let count = 0;
    try {
      for (;;) {
        const res = await fetch("/api/admin/marketing/sync-crm", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Sync failed.");
        count += json.synced ?? 0;
        setSynced(count);
        setTotal(json.total ?? 0);
        offset = json.nextOffset ?? offset;
        if (json.done) break;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setRunning(false);
    }
  }

  const pct = total ? Math.min(100, Math.round((synced / total) * 100)) : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Sync CRM contacts into Marketing Hub</p>
            <p className="text-xs text-slate-500">Pushes your imported contacts into the Marketing Hub contact list (matched by email). Safe to re-run.</p>
          </div>
        </div>
        <button onClick={run} disabled={running} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
          {running ? "Syncing…" : done ? "Synced" : "Sync now"}
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      {(running || done) && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full" style={{ width: `${pct}%`, background: BLUE }} />
            </div>
            <span className="tabular-nums text-xs font-medium text-slate-600">{synced.toLocaleString()}{total ? ` / ${total.toLocaleString()}` : ""}</span>
          </div>
          {done && <p className="mt-1 text-xs text-emerald-600">Done — {synced.toLocaleString()} contacts synced into the Marketing Hub.</p>}
        </div>
      )}
    </div>
  );
}
