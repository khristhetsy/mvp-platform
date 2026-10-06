"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceSection } from "@/components/admin/company-workspace/WorkspaceSection";
import {
  BASIS_LABEL,
  BASIS_TO_MONTH,
  METRICS,
  MONTHS,
  fmtGoal,
  localDay,
  localTime,
  goalAt,
  monthDays,
  monthLabel,
  shortDay,
  type GoalBasis,
  type GoalEntry,
  type MetricDef,
  type MetricKey,
} from "@/lib/analytics/message-activity-metrics";

export type MetricHistory = {
  key: MetricKey;
  months: Array<{ month: string; value: number }>;
  monthToDate: number;
};

const BASES: GoalBasis[] = ["day", "week", "month", "quarter", "year"];

export function MessageGoalsClient({
  entries,
  tableMissing,
  history,
  today,
  emailLogStart,
  canEdit,
}: Readonly<{
  entries: GoalEntry[];
  tableMissing: boolean;
  history: MetricHistory[];
  today: string;
  emailLogStart: string;
  canEdit: boolean;
}>) {
  const router = useRouter();
  const thisMonth = today.slice(0, 7);
  const [editing, setEditing] = useState<{ key: MetricKey; historyOnly: boolean } | null>(null);
  const editable = canEdit && !tableMissing;
  const prior = history[0]?.months.map((m) => m.month) ?? [];
  const dayOfMonth = +today.slice(8, 10);
  const share = dayOfMonth / monthDays(thisMonth);

  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap";
  const thN = `${th} text-right`;

  const table = (group: MetricDef["group"]) => (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[980px] border-collapse text-[13px]">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className={th}>Metric</th>
            <th className={th}>Better when</th>
            <th className={thN}>Monthly goal</th>
            <th className={th}>Since</th>
            {prior.map((m) => <th key={m} className={thN}>{MONTHS[+m.slice(5, 7) - 1]}</th>)}
            <th className={thN}>{MONTHS[+thisMonth.slice(5, 7) - 1]} to date</th>
            <th className={th}>Pace this month</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {METRICS.filter((m) => m.group === group).map((m) => {
            const h = history.find((x) => x.key === m.key);
            const e = goalAt(entries, m.key, thisMonth);
            const active = e && e.perMonth !== null ? e : null;
            const up = e ? e.direction === "up" : m.higherIsBetter;
            const count = entries.filter((x) => x.metricKey === m.key).length;
            let pace: React.ReactNode = <span className="text-xs text-slate-400">No goal</span>;
            if (active && h) {
              const expected = (active.perMonth as number) * share;
              const pct = expected > 0 ? (h.monthToDate / expected) * 100 : h.monthToDate ? 999 : 100;
              const tone = up ? (pct >= 100 ? "text-emerald-700" : pct >= 70 ? "text-amber-700" : "text-red-700") : pct <= 100 ? "text-emerald-700" : "text-red-700";
              pace = (
                <>
                  <span className={`font-semibold tabular-nums ${tone}`}>{pct >= 999 ? "Over" : `${Math.round(pct)}%`}</span>
                  <span className="block text-[11px] text-slate-500">{h.monthToDate} of {fmtGoal(expected)} expected by today</span>
                </>
              );
            }
            return (
              <tr key={m.key} className="border-t border-slate-100 align-middle">
                <td className="px-3 py-2.5">
                  <span className="font-semibold text-slate-900">{m.label}</span>
                  <span className="block text-[11.5px] text-slate-500">{m.description}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{up ? "▲ Higher" : "▼ Lower"}</td>
                <td className="px-3 py-2.5 text-right">
                  {active ? (
                    <>
                      <span className="text-base font-semibold tabular-nums text-slate-950">{fmtGoal(active.perMonth as number)}</span>
                      {active.basis && active.basis !== "month" && active.amount !== null ? (
                        <span className="block text-[11px] text-slate-500">entered as {fmtGoal(active.amount)} {BASIS_LABEL[active.basis]}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-slate-400">–</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{e ? `${e.perMonth === null ? "Stopped " : ""}${monthLabel(e.month)}` : "–"}</td>
                {h?.months.map((x) => <td key={x.month} className="px-3 py-2.5 text-right tabular-nums text-slate-700">{x.value}</td>)}
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">{h?.monthToDate ?? 0}</td>
                <td className="px-3 py-2.5">{pace}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {editable ? (
                    <button type="button" onClick={() => setEditing({ key: m.key, historyOnly: false })} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      {active ? "Edit" : "Set goal"}
                    </button>
                  ) : null}
                  {count ? (
                    <button type="button" onClick={() => setEditing({ key: m.key, historyOnly: true })} className="ml-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#1A6CE4] hover:bg-slate-50">
                      History ({count})
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const log = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="px-1">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Analytics · Founder and investor messages</p>
          <h1 className="mt-0.5 text-[22px] font-medium tracking-tight text-slate-950">Message goals</h1>
          <p className="mt-1 max-w-3xl text-xs text-slate-500">
            Goals are monthly and start in the month you choose. Each one stays in force until you change or stop it, so past periods are
            measured against the goal that applied at the time. The dashboard prorates them to whatever dates you look at.
          </p>
        </div>
        <Link href="/admin/message-activity" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <i className="ti ti-chevron-left mr-1" aria-hidden="true" />
          Dashboard
        </Link>
      </div>

      {tableMissing ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Goals can&apos;t be saved yet: the message_activity_goals migration hasn&apos;t been applied.
        </p>
      ) : !canEdit ? (
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          You can view goals. Changing them needs the Manage reports permission.
        </p>
      ) : null}

      <div className="mb-6">
        <WorkspaceSection icon="ti-inbox" tone="blue" title="Received by founders" subtitle="What iCapOS sends to founders">
          {table("received")}
        </WorkspaceSection>
      </div>
      <div className="mb-6">
        <WorkspaceSection icon="ti-send" tone="teal" title="Sent to investors" subtitle="Outreach and introductions on founders' behalf">
          {table("sent")}
        </WorkspaceSection>
      </div>
      <div className="mb-6">
        <WorkspaceSection icon="ti-history" tone="gray" title="Change history" subtitle="Every goal change, newest first">
          {log.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className={th}>When</th>
                    <th className={th}>Metric</th>
                    <th className={th}>Change</th>
                    <th className={th}>Note</th>
                    <th className={th}>By</th>
                  </tr>
                </thead>
                <tbody>
                  {log.slice(0, 50).map((e) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-slate-500">
                        {`${shortDay(localDay(e.createdAt))} ${e.createdAt.slice(0, 4)} ${localTime(e.createdAt)}`}
                      </td>
                      <td className="px-3 py-2 text-slate-900">{METRICS.find((m) => m.key === e.metricKey)?.label}</td>
                      <td className="px-3 py-2 text-slate-700">{changeText(e)}</td>
                      <td className="px-3 py-2 text-slate-700">{e.note ?? ""}</td>
                      <td className="px-3 py-2 text-slate-700">{e.createdByName ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
              No goal changes yet. Set a goal above and it will be logged here.
            </p>
          )}
        </WorkspaceSection>
      </div>
      <p className="text-[11px] text-slate-500">
        Monthly actuals count every founder, with no plan or search filter. Pace compares this month&apos;s actual so far with the goal
        prorated to today. Months and dates are Pacific time. Emails are logged from {shortDay(emailLogStart)} {emailLogStart.slice(0, 4)}.
      </p>

      {editing ? (
        <GoalEditor
          metric={METRICS.find((m) => m.key === editing.key) as MetricDef}
          entries={entries.filter((e) => e.metricKey === editing.key)}
          history={history.find((h) => h.key === editing.key)}
          thisMonth={thisMonth}
          historyOnly={editing.historyOnly}
          editable={editable}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
          onChanged={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

function changeText(e: GoalEntry): string {
  if (e.perMonth === null) return `Stopped from ${monthLabel(e.month)}`;
  const entered = e.basis && e.basis !== "month" && e.amount !== null ? ` (entered ${fmtGoal(e.amount)} ${BASIS_LABEL[e.basis]})` : "";
  return `Set to ${fmtGoal(e.perMonth)} per month from ${monthLabel(e.month)}${entered}`;
}

function GoalEditor({
  metric,
  entries,
  history,
  thisMonth,
  historyOnly,
  editable,
  onClose,
  onSaved,
  onChanged,
}: Readonly<{
  metric: MetricDef;
  entries: GoalEntry[];
  history: MetricHistory | undefined;
  thisMonth: string;
  historyOnly: boolean;
  editable: boolean;
  onClose: () => void;
  onSaved: () => void;
  onChanged: () => void;
}>) {
  const current = goalAt(entries, metric.key, thisMonth);
  const active = current && current.perMonth !== null ? current : null;
  const [amount, setAmount] = useState(active ? String(active.amount ?? active.perMonth) : "");
  const [basis, setBasis] = useState<GoalBasis>(active?.basis ?? "month");
  const [month, setMonth] = useState(thisMonth);
  const [direction, setDirection] = useState<"up" | "down">(current?.direction ?? (metric.higherIsBetter ? "up" : "down"));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const avg = history ? Math.round(history.months.reduce((a, m) => a + m.value, 0) / Math.max(1, history.months.length)) : null;
  const n = Number(amount);
  const preview = amount !== "" && Number.isFinite(n) && n >= 0 ? n * BASIS_TO_MONTH[basis] : null;

  async function submit(stop: boolean) {
    setError(null);
    if (!stop && (amount.trim() === "" || !Number.isFinite(n) || n < 0)) {
      setError("Enter a goal of 0 or more.");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setError("Choose the month the goal starts.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/message-activity/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stop ? { metricKey: metric.key, month: thisMonth, stop: true, direction, note } : { metricKey: metric.key, month, amount: n, basis, direction, note }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const j = res ? await res.json().catch(() => ({})) : {};
      setError((j as { error?: string }).error ?? "The goal wasn't saved. Try again.");
      return;
    }
    onSaved();
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/message-activity/goals?id=${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) setError("That entry wasn't removed. Try again.");
    else onChanged();
  }

  const sorted = [...entries].sort((a, b) => (a.month < b.month ? 1 : -1));
  const label = "w-28 shrink-0 text-xs text-slate-500";
  const input = "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-900 disabled:bg-slate-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true" aria-label={metric.label} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{historyOnly ? "Goal history" : "Goal"}</p>
            <h3 className="text-base font-semibold text-slate-900">{metric.label}</h3>
            <p className="text-xs text-slate-500">{active ? `${fmtGoal(active.perMonth as number)} per month since ${monthLabel(active.month)}` : "No goal in force"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50" aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {historyOnly ? null : (
            <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); void submit(false); }}>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="goal-amount" className={label}>Goal</label>
                <input id="goal-amount" type="number" min={0} step={1} value={amount} disabled={!editable} onChange={(e) => { setAmount(e.target.value); setError(null); }} className={`${input} w-28`} />
                <select id="goal-basis" aria-label="Per" value={basis} disabled={!editable} onChange={(e) => setBasis(e.target.value as GoalBasis)} className={input}>
                  {BASES.map((b) => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}
                </select>
              </div>
              {preview !== null ? (
                <p className="pl-[7.5rem] text-xs text-slate-500">
                  Equals {fmtGoal(preview)} per month, about {fmtGoal((preview * 7 * 12) / 365.25)} per week.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="goal-month" className={label}>Starts in</label>
                <input id="goal-month" type="month" value={month} disabled={!editable} onChange={(e) => setMonth(e.target.value)} className={input} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="goal-direction" className={label}>Better when</label>
                <select id="goal-direction" value={direction} disabled={!editable} onChange={(e) => setDirection(e.target.value as "up" | "down")} className={input}>
                  <option value="up">Higher is better</option>
                  <option value="down">Lower is better</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="goal-note" className={label}>Note</label>
                <input id="goal-note" type="text" maxLength={200} value={note} disabled={!editable} onChange={(e) => setNote(e.target.value)} placeholder="Why this goal" className={`${input} min-w-0 flex-1`} />
              </div>
              {avg !== null ? (
                <p className="text-xs text-slate-500">
                  Last 3 full months averaged {avg} per month. Earlier months keep the goal that applied to them.
                </p>
              ) : null}
              {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" disabled={!editable || busy} className="rounded-lg bg-[#1A6CE4] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-50">
                  {busy ? "Saving…" : "Save goal"}
                </button>
                {active ? (
                  <button type="button" disabled={!editable || busy} onClick={() => void submit(true)} className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    Stop goal from {MONTHS[+thisMonth.slice(5, 7) - 1]}
                  </button>
                ) : null}
                <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          )}

          {sorted.length ? (
            <div className={historyOnly ? "" : "mt-5"}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">History</h4>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {sorted.map((e) => (
                      <tr key={e.id} className="border-t border-slate-100 first:border-t-0">
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500">{monthLabel(e.month)}</td>
                        <td className="px-3 py-2 text-slate-900">{e.perMonth === null ? "Stopped" : `${fmtGoal(e.perMonth)}/mo`}</td>
                        <td className="px-3 py-2 text-slate-600">{e.note ?? ""}</td>
                        <td className="px-3 py-2 text-slate-600">{e.createdByName ?? ""}</td>
                        <td className="px-3 py-2 text-right">
                          {editable ? (
                            <button type="button" disabled={busy} onClick={() => void remove(e.id)} className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50">Remove</button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {historyOnly && error ? <p className="mt-2 text-xs text-red-700" role="alert">{error}</p> : null}
            </div>
          ) : historyOnly ? (
            <p className="text-xs text-slate-500">No history yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
