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
      <div className="mb-4 flex gap-2">
        {(["new", "contacted", "dismissed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
            {f !== "all" ? ` (${counts[f]})` : ""}
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
            <div key={r.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <p className="text-sm text-slate-900">
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
              <div className="flex flex-none items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.status]}`}>
                  {r.status}
                </span>
                {r.status !== "contacted" && (
                  <button
                    onClick={() => update(r.id, "contacted")}
                    disabled={busy === r.id}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Mark contacted
                  </button>
                )}
                {r.status !== "dismissed" ? (
                  <button
                    onClick={() => update(r.id, "dismissed")}
                    disabled={busy === r.id}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                ) : (
                  <button
                    onClick={() => update(r.id, "new")}
                    disabled={busy === r.id}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
