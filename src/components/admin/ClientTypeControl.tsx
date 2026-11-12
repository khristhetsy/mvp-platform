"use client";

import { useCallback, useEffect, useState } from "react";
import { CLIENT_TYPE_LABEL, type ClientType } from "@/lib/listing/client-type";

type LogRow = { id: string; from_type: string; to_type: string; changed_at: string };

/**
 * Client type on the admin company page. Everyone on staff sees it; only super
 * admins can change it, because the client may sign the SPV agreement outside
 * iCapOS. Every change is logged.
 */
export function ClientTypeControl({ companyId }: Readonly<{ companyId: string }>) {
  const [clientType, setClientType] = useState<ClientType>("standard");
  const [canEdit, setCanEdit] = useState(false);
  const [log, setLog] = useState<LogRow[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/companies/${companyId}/client-type`);
    if (!res.ok) return;
    const data = (await res.json()) as { clientType: ClientType; canEdit: boolean; log: LogRow[] };
    setClientType(data.clientType);
    setCanEdit(data.canEdit);
    setLog(data.log ?? []);
  }, [companyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load the client type on mount
  useEffect(() => { void load(); }, [load]);

  async function save(next: ClientType) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/client-type`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientType: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setMsg("Saved.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const spv = clientType === "spv";
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-slate-900">Client type</span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${spv ? "bg-blue-50 text-[#1A6CE4]" : "bg-slate-100 text-slate-600"}`}>
          {CLIENT_TYPE_LABEL[clientType]}
        </span>
        <span className="text-sm text-slate-600">Raise amount on one pager: {spv ? "Shown" : "Hidden"}</span>
        <span className="ml-auto flex items-center gap-2">
          {canEdit ? (
            <select
              aria-label="Change client type"
              value={clientType}
              disabled={busy}
              onChange={(e) => void save(e.target.value as ClientType)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="standard">{CLIENT_TYPE_LABEL.standard}</option>
              <option value="spv">{CLIENT_TYPE_LABEL.spv}</option>
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            aria-expanded={showLog}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[#0A1A40] hover:bg-slate-50"
          >
            View audit log
          </button>
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Only SPV clients show a raise amount. {canEdit ? "Every change is logged." : "Only super admins can change the type. Every change is logged."}
      </p>
      {msg ? <p className={`mt-1 text-xs ${msg === "Saved." ? "text-emerald-700" : "text-red-700"}`}>{msg}</p> : null}
      {showLog ? (
        log.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No changes logged yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {log.map((r) => (
              <li key={r.id}>
                {new Date(r.changed_at).toLocaleString()}: {CLIENT_TYPE_LABEL[r.from_type as ClientType] ?? r.from_type} to{" "}
                {CLIENT_TYPE_LABEL[r.to_type as ClientType] ?? r.to_type}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
