"use client";

import { useState } from "react";
import { ACTION_COLOR, ACTION_MARK, MorePanel, RingGrid } from "@/components/admin/dashboard/AdminDepartmentDashboard";
import { MetricDetailDrawer } from "@/components/ui/MetricDetailDrawer";
import type { SystemDashboard } from "@/lib/dashboard/system-dashboard";

const PILL = { good: "bg-emerald-50 text-emerald-700", bad: "bg-red-50 text-red-700", warn: "bg-amber-50 text-amber-700", none: "bg-slate-100 text-slate-500" } as const;
const CARD = "rounded-2xl border border-slate-200 bg-white p-4";
const ROW = "flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-left text-[13px] hover:bg-slate-50";
const BAR_PX = 72;

/** System dashboard body. Every ring, chip, row, bar and action opens a popup. */
export function SystemDashboardView({ d }: Readonly<{ d: SystemDashboard }>) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [ai, setAi] = useState<{ state: "idle" | "loading" | "done"; text: string | null }>({ state: "idle", text: null });
  const pop = openKey ? d.popups[openKey] : null;
  const urgent = d.need.some((n) => n.attention);
  const max = Math.max(1, ...(d.timeline ?? []).map((b) => b.total));

  async function explain() {
    setAi({ state: "loading", text: null });
    try {
      const res = await fetch("/api/metrics/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "System dashboard", value: d.pill.text, detail: d.advisor.slice(0, 400), audience: "admin" }),
      });
      const j = await res.json().catch(() => ({}));
      setAi({ state: "done", text: typeof j.text === "string" ? j.text : null });
    } catch {
      setAi({ state: "done", text: null });
    }
  }

  return (
    <div>
      <div className={`mb-4 flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-2.5 text-[13px] ${urgent ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
        <span className={`mr-1 text-[11px] font-medium uppercase tracking-wider ${urgent ? "text-red-800" : "text-slate-600"}`}>Needs you today</span>
        {d.need.map((n) => (
          <button key={n.key} type="button" aria-haspopup="dialog" onClick={() => setOpenKey(n.key)} className="rounded-full bg-white px-3 py-1 text-slate-800 hover:text-[#2E78F5]">
            <b className={`mr-1 text-[16px] ${n.attention ? "text-red-700" : "text-slate-700"}`}>{n.value}</b>{n.label}
          </button>
        ))}
      </div>

      <section className={CARD}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <b className="text-[14px] text-slate-900">System status</b>
          <span className={`ml-auto rounded-lg px-3 py-1 text-[12px] ${PILL[d.pill.tone]}`}>{d.pill.text}</span>
        </div>
        <div className="border-b border-slate-100 pb-3"><RingGrid rings={d.rings} period="month" onOpen={(m) => setOpenKey(m.id)} /></div>
        <p className="pt-3 text-[13px] text-slate-600">{d.summary}</p>
      </section>

      <details className="mt-4">
        <summary className="cursor-pointer text-[13px] font-medium text-[#1A6CE4]">More metrics ({d.more.length})</summary>
        <MorePanel panel={{ title: "More metrics", subtitle: "pages, imports, exports and beta", rings: d.more }} period="month" onOpen={(m) => setOpenKey(m.id)} />
      </details>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className={CARD}>
          <h3 className="mb-3 text-[13.5px] font-semibold text-slate-900">Integrations</h3>
          {d.integrations.map((i) => (
            <button key={i.key} type="button" aria-haspopup="dialog" onClick={() => setOpenKey(i.key)} className={ROW}>
              <span className="text-slate-800">{i.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL[i.tone]}`}>{i.status}</span>
            </button>
          ))}
        </section>
        <section className={CARD}>
          <h3 className="mb-3 text-[13.5px] font-semibold text-slate-900">Next best actions</h3>
          {d.actions.map((a) => (
            <button key={a.text} type="button" aria-haspopup="dialog" onClick={() => setOpenKey(a.key)} className={ROW}>
              <span className="flex items-center gap-2 text-slate-800"><b style={{ color: ACTION_COLOR[a.tone] }}>{ACTION_MARK[a.tone]}</b>{a.text}</span>
              <span className="whitespace-nowrap text-[12.5px] text-[#1A6CE4]">Open →</span>
            </button>
          ))}
        </section>
      </div>

      <section className={`mt-4 ${CARD}`}>
        <h3 className="mb-3 text-[13.5px] font-semibold text-slate-900">Delivery timeline, last 24 hours</h3>
        {d.timeline ? (
          <>
            <div className="grid grid-cols-12 items-end gap-1.5">
              {d.timeline.map((b) => (
                <button key={b.key} type="button" aria-haspopup="dialog" onClick={() => setOpenKey(b.key)} title={`${b.label}: ${b.total} deliveries, ${b.failed} failed`} aria-label={`${b.label}: ${b.total} deliveries, ${b.failed} failed`} className="flex flex-col items-center justify-end rounded-lg px-1 pt-1 hover:bg-slate-50">
                  <span className="text-[11px] tabular-nums text-slate-500">{b.total}</span>
                  <span className={`w-full rounded-t ${b.failed > 0 ? "bg-red-500" : b.total > 0 ? "bg-[#1A6CE4]" : "bg-slate-200"}`} style={{ height: b.total > 0 ? Math.max(6, Math.round((b.total / max) * BAR_PX)) : 3 }} />
                  <span className="mt-1 text-[10px] text-slate-500">{b.label.slice(0, 5)}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-slate-500">Each bar is two hours, in UTC. Red means at least one delivery failed.</p>
          </>
        ) : (
          <p className="text-[13px] text-slate-500">The delivery log could not be read.</p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-[#c7d7f5] bg-[#f3f7ff] p-4">
        <b className="text-[13.5px] text-[#185FA5]">AI advisor</b>
        <p className="mt-1 text-[13px] text-blue-800">{d.advisor}</p>
        {ai.state === "idle" ? (
          <button type="button" onClick={explain} className="mt-2 text-xs font-semibold text-[#1A6CE4] hover:underline"><i className="ti ti-sparkles" aria-hidden="true" /> Explain with AI</button>
        ) : (
          <p className="mt-2 text-[13px] text-blue-900">{ai.state === "loading" ? "Reading the figures…" : ai.text ?? "No explanation available. The AI service is off or did not answer."}</p>
        )}
      </section>

      <p className="mt-4 text-[11.5px] text-slate-500">Read {d.readAt}. A figure with no stored count shows live.</p>

      {pop ? (
        <MetricDetailDrawer key={openKey} open onClose={() => setOpenKey(null)} label={pop.label} value={pop.value} unit={pop.unit} detail={pop.detail} flag={pop.flag} audience="admin" extra={pop.extra} />
      ) : null}
    </div>
  );
}
