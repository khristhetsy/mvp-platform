"use client";

import { useState } from "react";
import Link from "next/link";
import { MetricDetailDrawer, type MetricDetail } from "@/components/ui/MetricDetailDrawer";
import {
  PERIODS,
  changeBreakdown,
  describeChange,
  pillFor,
  type DepartmentMetric,
  type Period,
} from "@/lib/dashboard/department-metrics";
import type { DashPanel, DashboardData, TabData, TabId } from "@/lib/dashboard/admin-dashboard";

const RING_COLOR = "#1A6CE4";
const WARN_COLOR = "#B45309";
const PILL_CLASS = { good: "bg-emerald-50 text-emerald-700", bad: "bg-red-50 text-red-700", none: "bg-slate-100 text-slate-500" } as const;
export const ACTION_COLOR = { bad: "#b91c1c", warn: "#b45309", good: "#15803d" } as const;
export const ACTION_MARK = { bad: "!", warn: "●", good: "★" } as const;

function Ring({ metric, period, onOpen }: Readonly<{ metric: DepartmentMetric; period: Period; onOpen: (m: DepartmentMetric) => void }>) {
  const c = 2 * Math.PI * 24;
  const text = metric.valueText ?? String(metric.value);
  const pill = pillFor(metric, period);
  const filled = typeof metric.percent === "number";
  const warn = metric.higherIsWorse === true && metric.value > 0 && !metric.note;
  return (
    <button type="button" onClick={() => onOpen(metric)} aria-haspopup="dialog" className="rounded-xl px-1 py-1 text-center text-[11.5px] text-slate-600 transition hover:bg-slate-50">
      <svg width="60" height="60" viewBox="0 0 60 60" className="mx-auto mb-1.5" role="img" aria-label={`${metric.label} ${text}`}>
        <circle cx="30" cy="30" r="24" fill="none" stroke="#eef2f7" strokeWidth="5" strokeDasharray={filled ? undefined : "3 4"} />
        {filled ? (
          <circle cx="30" cy="30" r="24" fill="none" stroke={warn ? WARN_COLOR : RING_COLOR} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${(c * Math.min(100, metric.percent as number)) / 100} ${c}`} transform="rotate(-90 30 30)" />
        ) : null}
        <text x="30" y="35" textAnchor="middle" fontSize={text.length > 6 ? 9 : text.length > 3 ? 11 : 15} fontWeight={600} fill="#0f172a">{text}</text>
      </svg>
      <span className="block font-medium text-slate-900">{metric.label}</span>
      <span className="block text-slate-500">{filled ? `${metric.percent}%` : "no ceiling"}</span>
      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${PILL_CLASS[pill.tone]}`}>{pill.text}</span>
    </button>
  );
}

export function RingGrid({ rings, period, onOpen }: Readonly<{ rings: DepartmentMetric[]; period: Period; onOpen: (m: DepartmentMetric) => void }>) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(rings.length, 1), 8)}, minmax(0, 1fr))` }}>
      {rings.map((m) => <Ring key={m.id} metric={m} period={period} onOpen={onOpen} />)}
    </div>
  );
}

export function MorePanel({ panel, period, onOpen }: Readonly<{ panel: DashPanel; period: Period; onOpen: (m: DepartmentMetric) => void }>) {
  if (panel.rings.length === 0) return null;
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-[13px]"><b className="text-slate-900">{panel.title}</b> <span className="text-slate-500">{panel.subtitle}</span></p>
      <RingGrid rings={panel.rings} period={period} onOpen={onOpen} />
    </div>
  );
}

export function AdminDepartmentDashboard({ data }: Readonly<{ data: DashboardData }>) {
  const [tabId, setTabId] = useState<TabId>("dashboard");
  const [period, setPeriod] = useState<Period>("month");
  const [selected, setSelected] = useState<DepartmentMetric | null>(null);
  const tab: TabData = data.tabs.find((t) => t.id === tabId) ?? data.tabs[0]!;
  const asOf = new Date(data.loadedAt).toUTCString();
  const pill = typeof tab.pill === "string" ? tab.pill : tab.pill?.[period];
  const moreCount = tab.more.reduce((a, p) => a + p.rings.length, 0);

  const detail = (m: DepartmentMetric): MetricDetail => ({
    breakdown: changeBreakdown(m),
    href: m.href,
    hrefLabel: "Open",
    note: [
      m.definition,
      m.flowLabel ? `Change counts ${m.flowLabel}.` : "No timestamp measures change for this figure, so no percentage is shown.",
      m.source ? `Source: ${m.source}.` : null,
      `Read ${asOf}.`,
      m.note,
    ].filter(Boolean).join(" "),
    chart: m.weekly ? { values: m.weekly, max: Math.max(1, ...m.weekly), unit: m.flowLabel ?? "", startLabel: "12 weeks ago", endLabel: "this week" } : undefined,
  });

  return (
    <div>
      <nav role="tablist" aria-label="Departments" className="mb-4 flex flex-wrap gap-x-6 border-b border-slate-200">
        {data.tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tab.id} onClick={() => setTabId(t.id)}
            className={`-mb-px border-b-2 py-2 text-[13.5px] transition ${t.id === tab.id ? "border-[#1A6CE4] font-medium text-[#1A6CE4]" : "border-transparent text-slate-600 hover:text-[#2E78F5]"}`}>
            {t.name}
          </button>
        ))}
      </nav>

      {tab.need.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px]">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-red-800">Needs you today</span>
          {tab.need.map((n) => {
            const body = <><b className="mr-1 text-[16px] text-red-700">{n.value}</b>{n.label}</>;
            return n.href
              ? <Link key={n.label} href={n.href} className="rounded-full bg-white px-3 py-1 text-slate-800 hover:text-[#2E78F5]">{body}</Link>
              : <span key={n.label} className="rounded-full bg-white px-3 py-1 text-slate-800">{body}</span>;
          })}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <b className="text-[14px] text-slate-900">{tab.title}</b>
          <span className="text-[12px] text-slate-500">{tab.subtitle}</span>
          <div className="inline-flex gap-0.5" role="group" aria-label="Compare against the prior">
            {PERIODS.map((p) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}
                className={`rounded-md px-2.5 py-1 text-xs capitalize transition ${period === p ? "bg-[#1A6CE4] text-white" : "text-slate-600 hover:bg-slate-50"}`}>{p}</button>
            ))}
          </div>
          {pill ? <span className="ml-auto rounded-lg bg-[#EEF5FD] px-3 py-1 text-[12px] text-[#185FA5]">{pill}</span> : null}
        </div>
        <div className="border-b border-slate-100 pb-3"><RingGrid rings={tab.rings} period={period} onOpen={setSelected} /></div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 pt-3 text-[13px] text-slate-600">
          {tab.summary.map((s) => <span key={s}>{s}</span>)}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-[13.5px] font-semibold text-slate-900">{tab.listTitle}</h3>
          {tab.rows.length === 0 ? <p className="text-[13px] text-slate-500">{tab.listEmpty}</p> : (
            <ul>
              {tab.rows.map((r) => {
                const inner = (
                  <>
                    <span className="flex items-center gap-2 text-slate-800"><i className="h-2 w-2 flex-none rounded-sm" style={{ background: r.color }} />{r.label}</span>
                    <span className={/^Not /.test(r.value) ? "text-slate-400" : "font-medium tabular-nums text-slate-700"}>{r.value}</span>
                  </>
                );
                const cls = "flex items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-[13px] hover:bg-slate-50";
                return (
                  <li key={`${r.label}-${r.value}`}>
                    {r.tab ? <button type="button" onClick={() => setTabId(r.tab as TabId)} className={`${cls} w-full text-left`}>{inner}</button>
                      : r.href ? <Link href={r.href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}
                  </li>
                );
              })}
            </ul>
          )}
          {tab.listLink ? <Link href={tab.listLink.href} className="mt-2 inline-block text-[12.5px] text-[#1A6CE4]">{tab.listLink.label}</Link> : null}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-[13.5px] font-semibold text-slate-900">Next best actions</h3>
          <ul>
            {tab.actions.map((a) => (
              <li key={a.text} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                <span className="flex items-center gap-2 text-slate-800"><b style={{ color: ACTION_COLOR[a.tone] }}>{ACTION_MARK[a.tone]}</b>{a.text}</span>
                {a.href ? <Link href={a.href} className="whitespace-nowrap text-[12.5px] text-[#1A6CE4]">{a.linkLabel ?? "Open →"}</Link> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-[#c7d7f5] bg-[#f3f7ff] p-4 lg:max-w-[58%]">
        <b className="text-[13.5px] text-[#185FA5]">Summary</b>
        <p className="mt-1 text-[13px] text-blue-800">{tab.advisor}</p>
      </section>

      {moreCount > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] font-medium text-[#1A6CE4]">More metrics ({moreCount})</summary>
          {tab.more.map((p) => <MorePanel key={p.title} panel={p} period={period} onOpen={setSelected} />)}
        </details>
      ) : null}

      <p className="mt-4 text-[11.5px] text-slate-500">
        Compared with the prior {period}. Percent shows only when the prior period had data. Read {asOf}.
      </p>

      {selected ? (
        <MetricDetailDrawer
          open
          onClose={() => setSelected(null)}
          label={selected.label}
          value={selected.valueText ?? String(selected.value)}
          detail={selected.detail}
          flag={(() => { const c = describeChange(selected, period); return c ? { text: c.text, tone: c.tone } : selected.note ? { text: selected.note, tone: "warn" as const } : null; })()}
          audience="admin"
          extra={detail(selected)}
        />
      ) : null}
    </div>
  );
}
