"use client";

import { useState } from "react";
import type { ProspectIntroRequest, ProspectIntroStatus } from "@/lib/matching/prospect-intros";

const STATUS_STYLE: Record<ProspectIntroStatus, string> = {
  new: "bg-amber-50 text-amber-700 border-amber-200",
  contacted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  dismissed: "bg-slate-100 text-slate-500 border-slate-200",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ProspectIntrosClient({ initial }: { initial: ProspectIntroRequest[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ProspectIntroStatus>("new");
  const [dlg, setDlg] = useState<{ id: string; label: string; to: string | null; subject: string; message: string; markContacted: boolean; sending: boolean; error: string | null } | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  async function openSend(r: ProspectIntroRequest) {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/prospect-intros/${r.id}/send`);
      const j = (await res.json().catch(() => null)) as { to?: string | null; subject?: string; body?: string; error?: string } | null;
      if (!res.ok || !j) {
        window.alert(j?.error ?? "Could not load the draft.");
        return;
      }
      setDlg({ id: r.id, label: `${r.companyName ?? "A founder"} to ${r.prospectName ?? "the investor"}`, to: j.to ?? null, subject: j.subject ?? "", message: j.body ?? "", markContacted: true, sending: false, error: null });
    } finally {
      setBusy(null);
    }
  }

  async function doSend() {
    if (!dlg) return;
    setDlg({ ...dlg, sending: true, error: null });
    const res = await fetch(`/api/admin/prospect-intros/${dlg.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: dlg.subject, message: dlg.message }),
    });
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setDlg({ ...dlg, sending: false, error: j?.error ?? "Could not send." });
      return;
    }
    setSentIds((prev) => new Set(prev).add(dlg.id));
    const row = rows.find((x) => x.id === dlg.id);
    if (dlg.markContacted && row && row.status !== "contacted") await update(dlg.id, "contacted");
    setDlg(null);
  }

  async function update(id: string, status: ProspectIntroStatus) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/prospect-intros/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } finally {
      setBusy(null);
    }
  }

  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const counts = {
    new: rows.filter((r) => r.status === "new").length,
    contacted: rows.filter((r) => r.status === "contacted").length,
    dismissed: rows.filter((r) => r.status === "dismissed").length,
  };

  return (
    <div>
      <div className="mb-4 flex gap-2 max-sm:grid max-sm:grid-cols-4 max-sm:gap-1 max-sm:rounded-xl max-sm:bg-slate-100 max-sm:p-1">
        {(["new", "contacted", "dismissed", "all"] as const).map((f) => (
          <button type="button"
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm max-sm:min-w-0 max-sm:whitespace-nowrap max-sm:px-1 max-sm:py-2 max-sm:text-[11px] ${
              filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 max-sm:bg-transparent"
            }`}
          >
            <span className="max-sm:hidden">
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
              {f !== "all" ? ` (${counts[f]})` : ""}
            </span>
            <span className="hidden max-sm:inline">
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
              {f !== "all" ? ` ${counts[f]}` : ""}
            </span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
          No {filter === "all" ? "" : filter} brokered intro requests.
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.id} className="relative flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
              <div className="min-w-0 max-sm:pr-16">
                <p className="text-sm text-slate-900 [overflow-wrap:anywhere]">
                  <span className="font-semibold">{r.companyName ?? "A founder"}</span>
                  <span className="text-slate-400"> wants an intro to </span>
                  <span className="font-semibold">{r.prospectName ?? "a prospect investor"}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {r.founderName ? `${r.founderName} · ` : ""}
                  {fmt(r.createdAt)}
                </p>
                {r.note && (
                  <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500"><i className="ti ti-pencil" aria-hidden="true" /> Founder&apos;s intro note</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs italic text-slate-700">&ldquo;{r.note}&rdquo;</p>
                  </div>
                )}
              </div>
              <div className="flex flex-none items-center gap-2 max-sm:contents">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium max-sm:absolute max-sm:right-4 max-sm:top-4 ${STATUS_STYLE[r.status]}`}>
                  {r.status}
                </span>
                <div className="flex items-center gap-2 max-sm:grid max-sm:grid-cols-2">
                {r.status !== "dismissed" && (
                  <button type="button"
                    onClick={() => openSend(r)}
                    disabled={busy === r.id || sentIds.has(r.id)}
                    className={`rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 max-sm:py-2.5 ${r.status === "new" ? "max-sm:col-span-2" : ""}`}
                  >
                    {sentIds.has(r.id) ? "Sent" : "Send intro"}
                  </button>
                )}
                {r.status !== "contacted" && (
                  <button type="button"
                    onClick={() => update(r.id, "contacted")}
                    disabled={busy === r.id}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60 max-sm:py-2.5"
                  >
                    Mark contacted
                  </button>
                )}
                {r.status !== "dismissed" ? (
                  <button type="button"
                    onClick={() => update(r.id, "dismissed")}
                    disabled={busy === r.id}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 max-sm:py-2.5"
                  >
                    Dismiss
                  </button>
                ) : (
                  <button type="button"
                    onClick={() => update(r.id, "new")}
                    disabled={busy === r.id}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 max-sm:py-2.5"
                  >
                    Reopen
                  </button>
                )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Send intro</h2>
            <p className="text-xs text-slate-400">{dlg.label}</p>
            <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-slate-400">To</label>
            <input readOnly value={dlg.to ?? "No email address on file"} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
            <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Subject</label>
            <input value={dlg.subject} onChange={(e) => setDlg({ ...dlg, subject: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Message (edit before sending)</label>
            <textarea value={dlg.message} onChange={(e) => setDlg({ ...dlg, message: e.target.value })} className="mt-1 min-h-[240px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={dlg.markContacted} onChange={(e) => setDlg({ ...dlg, markContacted: e.target.checked })} />
              Mark as contacted and notify the founder
            </label>
            <p className="mt-1 text-xs text-slate-400">Sends from iCapOS, is saved to the email log, and tracks delivered, opened and clicked.</p>
            {dlg.error && <p className="mt-2 text-xs text-red-600">{dlg.error}</p>}
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={() => setDlg(null)} disabled={dlg.sending} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={doSend} disabled={dlg.sending || !dlg.to || !dlg.subject.trim() || !dlg.message.trim()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
                {dlg.sending ? "Sending..." : "Approve and send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
