"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Send } from "lucide-react";
import type { DataRoomTrackerRow, DataRoomTrackerSummary } from "@/lib/data-room/admin-tracker";

type Filter = "stalled" | "core_incomplete" | "all";

export function DataRoomTrackerClient({
  rows,
  summary,
}: {
  rows: DataRoomTrackerRow[];
  summary: DataRoomTrackerSummary;
}) {
  const t = useTranslations("adminCmp");
  const [filter, setFilter] = useState<Filter>("core_incomplete");
  const [sent, setSent] = useState<Record<string, "sending" | "done" | "error">>({});

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "stalled") return rows.filter((r) => !r.coreComplete && (r.daysSinceLastDoc ?? r.daysSinceCreated) >= 7);
    return rows.filter((r) => !r.coreComplete);
  }, [rows, filter]);

  async function nudge(companyId: string) {
    setSent((p) => ({ ...p, [companyId]: "sending" }));
    try {
      const res = await fetch("/api/admin/data-room/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) throw new Error();
      setSent((p) => ({ ...p, [companyId]: "done" }));
    } catch {
      setSent((p) => ({ ...p, [companyId]: "error" }));
    }
  }

  const cards = [
    { label: "Founders", value: summary.totalFounders },
    { label: "Core complete", value: summary.coreComplete },
    { label: "Fully complete", value: summary.fullyComplete },
    { label: "Stalled 7d+", value: summary.stalled, danger: true },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("admin_operations")}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950">
          <ClipboardCheck className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden /> Diligence tracker
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Every founder&apos;s data-room completeness, who&apos;s stalled, and one-click chase. Core = the three investor-access essentials (pitch deck, financials, cap table).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${c.danger && c.value > 0 ? "text-rose-600" : "text-slate-900"}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {([["core_incomplete", "Core incomplete"], ["stalled", "Stalled 7d+"], ["all", "All founders"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${filter === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Company</th>
                <th className="px-4 py-2.5 font-semibold">Complete</th>
                <th className="px-4 py-2.5 font-semibold">Core missing</th>
                <th className="px-4 py-2.5 font-semibold">Stalled</th>
                <th className="px-4 py-2.5 font-semibold">Last nudge</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">No founders in this view.</td></tr>
              ) : filtered.map((r) => {
                const stalledDays = r.daysSinceLastDoc ?? r.daysSinceCreated;
                const status = sent[r.companyId];
                return (
                  <tr key={r.companyId} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/companies/${r.companyId}`} className="font-medium text-slate-900 hover:underline">{r.companyName}</Link>
                      <div className="text-xs text-slate-500">{r.founderName ?? r.founderEmail ?? "—"}{r.published ? " · listed" : ""}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${r.percent}%`, background: r.coreComplete ? "#1D9E75" : "#BA7517" }} />
                        </div>
                        <span className="tabular-nums text-xs text-slate-600">{r.percent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.coreComplete ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">core in</span>
                      ) : (
                        <span className="text-xs text-rose-700">{r.coreMissingLabels.join(", ")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs text-slate-600">
                      {r.coreComplete ? "—" : `${stalledDays}d`}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {r.lastNudgeAt ? new Date(r.lastNudgeAt).toLocaleDateString() : "never"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.missingCount === 0 ? (
                        <span className="text-xs text-emerald-700">complete</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => nudge(r.companyId)}
                          disabled={status === "sending" || status === "done"}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {status === "done" ? "Sent" : status === "sending" ? "Sending…" : status === "error" ? "Retry" : "Nudge"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
