"use client";

/**
 * Reach goal vs actual: sent and opened against the goals set on Feature
 * Controls, for Introductions and Automated outreach, by week or by month.
 * Two tiles for the current period, then the last four periods as rows.
 */
import Link from "next/link";
import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { formatPlatformDateTime } from "@/lib/time/platform-tz";
import { goalProgress, type ReachActuals, type ReachGoalSection, type ReachGoals, type ReachPeriodKind } from "@/lib/admin/reach-goals";

const BLUE = "#1A6CE4";
const GREEN = "#059669";

const SECTIONS: Array<{ key: ReachGoalSection; title: string; hint: string }> = [
  { key: "intro", title: "Introductions", hint: "Investor intros requested by founders, then sent" },
  { key: "auto", title: "Automated outreach", hint: "Queued matches sent automatically" },
];

export function ReachGoalVsActualView({ actuals, goals }: Readonly<{ actuals: ReachActuals; goals: ReachGoals }>) {
  const [kind, setKind] = useState<ReachPeriodKind>("week");
  const rows = kind === "week" ? actuals.weeks : actuals.months;
  const current = rows[0];
  const goalOf = (section: ReachGoalSection, metric: "sent" | "opened") =>
    goals[section][metric === "sent" ? (kind === "week" ? "sentWeek" : "sentMonth") : kind === "week" ? "openedWeek" : "openedMonth"];
  const anyUnset = SECTIONS.some((s) => goalOf(s.key, "sent") === null || goalOf(s.key, "opened") === null);

  return (
    <section className="mb-6 space-y-4" aria-labelledby="reach-goal-vs-actual">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="reach-goal-vs-actual" className="text-lg font-semibold text-slate-950">Goal vs actual</h2>
          <p className="mt-0.5 text-sm text-slate-600">Introductions and Automated outreach, all companies, times in PT</p>
        </div>
        <div className="flex gap-1 rounded-[10px] bg-slate-200/80 p-1" role="group" aria-label="Period">
          {(["week", "month"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-[7px] px-4 py-1.5 text-sm font-semibold ${kind === k ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {k === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      {anyUnset ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
          Some {kind === "week" ? "weekly" : "monthly"} goals are not set, so those counts have nothing to measure against. Set them under Reach goals in{" "}
          <Link href="/admin/feature-controls#reach-goals" className="font-semibold text-[#1A6CE4] hover:text-[#2E78F5]">Feature Controls</Link>.
        </p>
      ) : null}

      {SECTIONS.map((s) => (
        <div key={s.key} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-slate-950">{s.title}</h3>
            <p className="text-xs text-slate-500">{s.hint}</p>
          </div>

          {current ? (
            <div className="grid gap-4 sm:grid-cols-2 [&>*]:h-full">
              {(["sent", "opened"] as const).map((metric) => {
                const actual = current[s.key][metric];
                const goal = goalOf(s.key, metric);
                const p = goalProgress(actual, goal);
                return (
                  <MetricCard
                    key={metric}
                    audience="admin"
                    label={`${kind === "week" ? "This week" : "This month"}: ${metric}`}
                    value={String(actual)}
                    unit={p ? `of ${goal} goal` : "No goal set"}
                    detail={`${current.range}, PT`}
                    ring={p ? { percent: p.percent, center: "", color: p.met ? GREEN : BLUE, title: `${actual} of ${goal} ${metric}` } : { percent: null, pending: true, center: "", title: `${actual} ${metric}, no goal set` }}
                    flag={p ? (p.met ? { text: "Goal met", tone: "good" } : { text: `${p.remaining} to goal` }) : null}
                  />
                );
              })}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <div className="min-w-[640px]" role="table" aria-label={`${s.title} by ${kind}`}>
              <div role="row" className="grid grid-cols-[1.1fr_2fr_2fr] items-center gap-4 border-b border-slate-200 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <div role="columnheader">{kind === "week" ? "Week" : "Month"}</div>
                <div role="columnheader">Sent, actual vs goal</div>
                <div role="columnheader">Opened, actual vs goal</div>
              </div>
              {rows.map((r) => (
                <div key={r.key} role="row" className="grid grid-cols-[1.1fr_2fr_2fr] items-center gap-4 border-b border-slate-100 py-3 text-sm last:border-b-0">
                  <div role="cell" className="font-medium text-slate-900">{r.label}</div>
                  <GoalCell actual={r[s.key].sent} goal={goalOf(s.key, "sent")} />
                  <GoalCell actual={r[s.key].opened} goal={goalOf(s.key, "opened")} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <p className="text-xs leading-5 text-slate-500">
        Counted from the Introductions and Automated outreach records on each company&rsquo;s Reach tab, as of {formatPlatformDateTime(actuals.generatedAt)}. A send counts in
        the {kind} the email went out and an open in the {kind} it was first opened. Automated sends logged in test mode reached no one and are not counted.
      </p>
    </section>
  );
}

function GoalCell({ actual, goal }: Readonly<{ actual: number; goal: number | null }>) {
  const p = goalProgress(actual, goal);
  return (
    <div role="cell" className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2">
        <span className="tabular-nums text-slate-700">
          <b className="font-semibold text-slate-950">{actual}</b>
          {p ? ` / ${goal}` : ""}
        </span>
        {p ? (
          <span className={`text-[13px] font-semibold ${p.met ? "text-emerald-700" : "text-[#185FA5]"}`}>{p.met ? "Goal met" : `${p.remaining} to goal`}</span>
        ) : (
          <span className="text-[13px] text-slate-500">No goal set</span>
        )}
      </div>
      {p ? (
        <div className="h-2 overflow-hidden rounded bg-slate-200" aria-hidden="true">
          <div className="h-full" style={{ width: `${p.percent}%`, backgroundColor: p.met ? GREEN : BLUE }} />
        </div>
      ) : null}
    </div>
  );
}
