"use client";

import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import {
  DEPARTMENT_NAME,
  DEPARTMENT_ORDER,
  PERIODS,
  PERIOD_LABEL,
  changeBreakdown,
  describeChange,
  openItemsByDepartment,
  shareOf,
  type DepartmentId,
  type DepartmentMetric,
  type Period,
} from "@/lib/dashboard/department-metrics";

type Tab = "all" | DepartmentId;

const DEPT_COLOR: Record<DepartmentId, string> = {
  sales: "#1A6CE4",
  marketing: "#185FA5",
  support: "#0A1A40",
  administration: "#2E78F5",
};

export function AdminDepartmentDashboard({
  metrics,
  loadedAt,
}: Readonly<{ metrics: DepartmentMetric[]; loadedAt: string }>) {
  const [tab, setTab] = useState<Tab>("all");
  const [period, setPeriod] = useState<Period>("week");
  const asOf = new Date(loadedAt).toUTCString();

  const openRows = openItemsByDepartment(metrics);
  const measuredRows = openRows.filter((r) => r.measured);
  const grandTotal = measuredRows.reduce((s, r) => s + r.total, 0);
  const maxTotal = Math.max(1, ...measuredRows.map((r) => r.total));
  const sources = shareOf(
    measuredRows.flatMap((r) => r.parts.filter((p) => p.value > 0).map((p) => ({ label: p.label, value: p.value }))),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Departments" className="flex flex-wrap gap-1.5">
          {(["all", ...DEPARTMENT_ORDER] as Tab[]).map((id) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                  active ? "bg-[#0A1A40] text-white" : "border border-slate-200 bg-white text-slate-600 hover:text-[#2E78F5]"
                }`}
              >
                {id === "all" ? "All departments" : DEPARTMENT_NAME[id]}
              </button>
            );
          })}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Compare against the prior">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                period === p ? "bg-[#1A6CE4] text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {tab === "all" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-[14px] font-semibold text-slate-900">By department</h3>
            <p className="mt-0.5 text-[12px] text-slate-500">Open items waiting for a person, today</p>
            <ul className="mt-4 space-y-3">
              {openRows.map((r) => (
                <li key={r.department}>
                  <button type="button" onClick={() => setTab(r.department)} className="block w-full text-left">
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="font-medium text-slate-800">{DEPARTMENT_NAME[r.department]}</span>
                      <span className="tabular-nums text-slate-700">
                        {r.measured ? `${r.total} open` : "Not measured"}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      {r.measured ? (
                        <div className="h-2 rounded-full" style={{ width: `${(r.total / maxTotal) * 100}%`, background: DEPT_COLOR[r.department] }} />
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-[14px] font-semibold text-slate-900">Where open items come from</h3>
            <p className="mt-0.5 text-[12px] text-slate-500">{grandTotal} open across measured departments</p>
            {grandTotal > 0 ? (
              <>
                <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
                  {sources.map((s, i) => (
                    <div key={s.label} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / grandTotal) * 100}%`, background: ["#0A1A40", "#1A6CE4", "#185FA5", "#2E78F5", "#93B8F0"][i % 5] }} />
                  ))}
                </div>
                <ul className="mt-4 space-y-1.5">
                  {sources.map((s, i) => (
                    <li key={s.label} className="flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 text-slate-700">
                        <span className="h-2 w-2 rounded-full" style={{ background: ["#0A1A40", "#1A6CE4", "#185FA5", "#2E78F5", "#93B8F0"][i % 5] }} />
                        {s.label}
                      </span>
                      <span className="tabular-nums text-slate-600">{s.value} · {s.percent}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-4 text-[13px] text-slate-500">Nothing is waiting on a person right now.</p>
            )}
          </section>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics
            .filter((m) => m.department === tab)
            .map((m) => {
              const change = describeChange(m, period);
              const weekly = m.weekly;
              return (
                <MetricCard
                  key={m.id}
                  label={m.label}
                  value={m.note && m.changes === null && m.value === 0 ? "n/a" : String(m.value)}
                  detail={m.detail}
                  audience="admin"
                  lastUpdated={loadedAt}
                  flag={change ? { text: change.text, tone: change.tone } : m.note ? { text: m.note, tone: "warn" } : null}
                  detailPanel={{
                    breakdown: changeBreakdown(m),
                    href: m.href,
                    hrefLabel: "Open",
                    note: [
                      m.flowLabel ? `Change counts ${m.flowLabel}.` : "No timestamp measures change for this figure, so no percentage is shown.",
                      `Read ${asOf}.`,
                      m.note,
                    ].filter(Boolean).join(" "),
                    chart: weekly
                      ? { values: weekly, max: Math.max(1, ...weekly), unit: m.flowLabel ?? "", startLabel: "12 weeks ago", endLabel: "this week" }
                      : undefined,
                  }}
                />
              );
            })}
        </div>
      )}
      <p className="mt-3 text-[11.5px] text-slate-500">
        Compared with the prior {PERIOD_LABEL[period]}. Read {asOf}.
      </p>
    </div>
  );
}
