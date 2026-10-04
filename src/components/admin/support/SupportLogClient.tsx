"use client";

import Link from "next/link";
import { useState } from "react";
import type { SupportLogData, LogRequestRow } from "@/lib/support/log-data";
import type { SupportActor, SupportEventRow } from "@/lib/support/events";

type Filter = "all" | "founder" | "ai" | "staff" | "system";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "founder", label: "Founder" },
  { key: "ai", label: "AI" },
  { key: "staff", label: "Staff" },
  { key: "system", label: "System" },
];

const ACTOR_STYLE: Record<SupportActor, { icon: string; cls: string }> = {
  founder: { icon: "ti-message", cls: "bg-indigo-50 text-indigo-600" },
  ai: { icon: "ti-sparkles", cls: "bg-teal-50 text-teal-700" },
  staff: { icon: "ti-user-check", cls: "bg-emerald-50 text-emerald-700" },
  system: { icon: "ti-settings-automation", cls: "bg-slate-100 text-slate-500" },
  alert: { icon: "ti-alarm", cls: "bg-amber-50 text-amber-700" },
};

const LEGEND_DOT: Record<SupportActor, string> = {
  founder: "bg-indigo-500",
  ai: "bg-teal-500",
  staff: "bg-emerald-500",
  system: "bg-slate-400",
  alert: "bg-amber-500",
};

const KIND_ICON: Partial<Record<string, string>> = {
  submitted: "ti-message",
  assigned: "ti-user-check",
  reassigned: "ti-arrows-exchange",
  confirmation_sent: "ti-mail",
  staff_notified: "ti-bell",
  founder_notified: "ti-mail",
  reminder: "ti-alarm",
  due_soon: "ti-clock-hour-4",
  overdue: "ti-alert-triangle",
  ai_triage: "ti-sparkles",
  ai_handoff: "ti-arrow-forward-up",
  ai_answer: "ti-sparkles",
  ai_answer_solved: "ti-thumb-up",
  ai_answer_needs_person: "ti-user",
  ai_draft: "ti-pencil",
  ai_summary: "ti-pencil",
  staff_reply: "ti-edit",
  founder_reply: "ti-message",
  resolved: "ti-circle-check",
  confirm_sent: "ti-mail",
  confirm_reminder: "ti-mail",
  founder_confirmed: "ti-thumb-up",
  founder_reopened: "ti-refresh",
  rated: "ti-star",
  closed: "ti-lock",
  founder_nudged: "ti-help-circle",
};

function span(ms: number | null): string {
  if (ms == null) return "None yet";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `${h}h`;
  return `${Math.max(1, Math.round(ms / 60_000))}m`;
}

const usd = (n: number) => `$${n.toFixed(n > 0 && n < 0.01 ? 4 : 2)}`;

function outcome(r: LogRequestRow): { label: string; cls: string } {
  if (r.status === "resolved" && r.csat === 1) return { label: r.rating ? `Confirmed ${"★".repeat(r.rating)}` : "Confirmed solved", cls: "bg-emerald-50 text-emerald-700" };
  if (r.status === "resolved" && r.closedAt) return { label: "Closed, no answer", cls: "bg-slate-100 text-slate-600" };
  if (r.status === "resolved") return { label: "Awaiting founder answer", cls: "bg-indigo-50 text-indigo-700" };
  if (r.status === "pending_founder") return { label: "Waiting on founder", cls: "bg-blue-50 text-blue-700" };
  if (r.reopenedCount) return { label: "Reopened", cls: "bg-red-50 text-red-700" };
  return { label: `Open ${span(Date.now() - new Date(r.createdAt).getTime())}`, cls: "bg-amber-50 text-amber-700" };
}

const stamp = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function matches(e: SupportEventRow, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "system") return e.actor === "system" || e.actor === "alert";
  return e.actor === f;
}

export function SupportLogClient({ data }: Readonly<{ data: SupportLogData }>) {
  const [filter, setFilter] = useState<Filter>("all");
  const { tiles, requests, selected } = data;
  const sel = selected ? requests.find((r) => r.id === selected.key) ?? null : null;
  const isAssistant = selected?.key === "assistant";
  const events = (selected?.events ?? []).filter((e) => matches(e, filter));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xl font-semibold text-slate-900">{tiles.answered ? span(tiles.medianFirstReplyMs) : span(tiles.longestWaitMs)}</p>
          <p className="text-[11.5px] text-slate-500">
            {tiles.answered ? `Median time to first staff reply (${tiles.answered} answered, 90 days)` : "Longest wait for a first reply, none answered yet"}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xl font-semibold text-slate-900">{tiles.onTimeOf ? `${tiles.onTime} of ${tiles.onTimeOf}` : "None yet"}</p>
          <p className="text-[11.5px] text-slate-500">Replied within the promised time (90 days)</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xl font-semibold text-slate-900">{tiles.aiAnswers ? `${tiles.aiSolved} of ${tiles.aiAnswers}` : "None yet"}</p>
          <p className="text-[11.5px] text-slate-500">
            AI answers marked &ldquo;That solved it&rdquo; (30 days){tiles.aiNeedsPerson ? ` · ${tiles.aiNeedsPerson} needed a person` : ""}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xl font-semibold text-slate-900">{usd(tiles.aiCostMonthUsd)}</p>
          <p className="text-[11.5px] text-slate-500">Support AI cost this month</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Link
            href="/admin/support/log?request=assistant"
            className={`block rounded-xl border bg-white p-3 hover:bg-slate-50 ${isAssistant ? "border-indigo-400 ring-1 ring-indigo-400" : "border-slate-200"}`}
          >
            <div className="flex items-center gap-2">
              <i className="ti ti-sparkles text-teal-700" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-slate-900">Assistant answers</span>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">{data.assistantAnswers} in 30 days</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">How-to questions the AI answered without a request</p>
          </Link>

          {requests.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No support requests yet.</div>
          ) : (
            requests.map((r) => {
              const o = outcome(r);
              const on = selected?.key === r.id;
              return (
                <Link
                  key={r.id}
                  href={`/admin/support/log?request=${r.id}`}
                  className={`block rounded-xl border bg-white p-3 hover:bg-slate-50 ${on ? "border-indigo-400 ring-1 ring-indigo-400" : "border-slate-200"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{r.subject}</span>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.cls}`}>{o.label}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {r.refNo ? `#${r.refNo} · ` : ""}
                    {r.founderName} · {r.companyName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {r.ownerName ? `Owner ${r.ownerName}` : "Unassigned"} · {r.staffReplies} staff {r.staffReplies === 1 ? "reply" : "replies"}
                    {r.viaAssistant ? " · via AI handoff" : ""}
                  </p>
                </Link>
              );
            })
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-slate-500">Select a request to see its activity.</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {isAssistant ? "Assistant answers" : sel ? `${sel.subject}${sel.refNo ? ` · #${sel.refNo}` : ""}` : "Request"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Activity log{selected.aiCostUsd > 0 ? ` · AI cost ${usd(selected.aiCostUsd)}` : ""}
                    {!isAssistant && sel ? (
                      <>
                        {" · "}
                        <Link href={`/admin/support?request=${sel.id}&resolved=1`} className="text-indigo-600 hover:underline">
                          Open in Support queue
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${filter === f.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <a
                    href={`/api/admin/support/log/export?request=${encodeURIComponent(selected.key)}`}
                    className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <i className="ti ti-download" aria-hidden="true" /> Export
                  </a>
                </div>
              </div>

              {events.length === 0 ? (
                <p className="py-6 text-sm text-slate-400">Nothing logged{filter === "all" ? " yet" : " for this filter"}.</p>
              ) : (
                <ol className="divide-y divide-slate-100">
                  {events.map((e) => {
                    const st = ACTOR_STYLE[e.actor] ?? ACTOR_STYLE.system;
                    const ai = (e.meta as { ai?: { model?: string; inputTokens?: number; outputTokens?: number; costUsd?: number } } | null)?.ai;
                    const who = isAssistant && e.founder_id ? selected.names[e.founder_id] : null;
                    return (
                      <li key={e.id} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 py-2.5">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${st.cls}`}>
                          <i className={`ti ${KIND_ICON[e.kind] ?? st.icon} text-[15px]`} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-medium text-slate-900">
                              {e.summary}
                              {who ? <span className="font-normal text-slate-500"> · {who}</span> : null}
                            </p>
                            <span className="flex-shrink-0 text-[11px] text-slate-400">{stamp(e.created_at)}</span>
                          </div>
                          {e.detail ? <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-slate-500">{e.detail}</p> : null}
                          {ai ? (
                            <p className="mt-1 inline-block rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                              {ai.model?.includes("haiku") ? "Claude Haiku" : ai.model?.includes("sonnet") ? "Claude Sonnet" : "Claude"} ·{" "}
                              {((ai.inputTokens ?? 0) + (ai.outputTokens ?? 0)).toLocaleString()} tokens · {usd(ai.costUsd ?? 0)}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
                {(["founder", "ai", "staff", "system", "alert"] as SupportActor[]).map((a) => (
                  <span key={a} className="inline-flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${LEGEND_DOT[a]}`} />
                    {a === "ai" ? "AI" : a[0].toUpperCase() + a.slice(1)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
