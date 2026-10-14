"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { OdooSearchBar, EMPTY_SEARCH, type FieldFilter, type QuickFilter, type SearchState } from "@/components/admin/OdooSearchBar";
import { OdooPager } from "@/components/admin/OdooPager";
import { Highlight, NoSearchMatches, SearchCount } from "@/components/ui/SearchStatus";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { matchRows, type SearchField } from "@/lib/ui/live-search";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";
import type { OperationalStatus } from "@/lib/ui/design-tokens";
import type { AiUsageRow, UsageStatus } from "@/lib/ai-usage/report";

const PAGE_SIZE = 50;

const STATUS_META: Record<UsageStatus, { label: string; tone: OperationalStatus }> = {
  over: { label: "Over limit", tone: "danger" },
  at_limit: { label: "At limit", tone: "danger" },
  near: { label: "Near limit", tone: "warning" },
  within: { label: "Within limit", tone: "success" },
  unlimited: { label: "Unlimited", tone: "neutral" },
};

function statusLabel(r: AiUsageRow): string {
  if (r.status === "unlimited" && r.planType === "admin_internal") return "Internal";
  return STATUS_META[r.status].label;
}

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PLATFORM_TZ });

const QUICK: QuickFilter[] = [
  { key: "blocked", label: "At or over limit" },
  { key: "near", label: "Near limit" },
  { key: "limited", label: "Has a limit" },
];

const SEARCH_FIELDS: SearchField<AiUsageRow>[] = [
  { label: "user", get: (r) => r.name },
  { label: "email", get: (r) => r.email },
  { label: "plan", get: (r) => r.planLabel },
  { label: "tool", get: (r) => r.featureLabel },
  { label: "status", get: (r) => statusLabel(r) },
  { label: "runs", get: (r) => r.used },
  { label: "cost", get: (r) => (r.costUsd === null ? "" : r.costUsd.toFixed(4)) },
];

export function AiUsageTable({ rows }: Readonly<{ rows: AiUsageRow[] }>) {
  const [state, setState] = useState<SearchState>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);

  const fieldFilters: FieldFilter[] = useMemo(
    () => [
      { key: "feature", label: "Tool", options: [...new Set(rows.map((r) => r.featureLabel))].sort() },
      { key: "plan", label: "Plan", options: [...new Set(rows.map((r) => r.planLabel))].sort() },
    ],
    [rows],
  );

  const result = useMemo(() => {
    const searched = matchRows(rows, SEARCH_FIELDS, state.q);
    const narrowed = searched.rows.filter((r) => {
      if (state.quick.includes("blocked") && r.status !== "at_limit" && r.status !== "over") return false;
      if (state.quick.includes("near") && r.status !== "near") return false;
      if (state.quick.includes("limited") && r.status === "unlimited") return false;
      const tools = state.fields.feature;
      if (tools && tools.length > 0 && !tools.includes(r.featureLabel)) return false;
      const plans = state.fields.plan;
      if (plans && plans.length > 0 && !plans.includes(r.planLabel)) return false;
      return true;
    });
    const filtered = state.quick.length > 0 || Object.values(state.fields).some((v) => v.length > 0);
    return { ...searched, rows: narrowed, active: searched.active || filtered };
  }, [rows, state]);

  const pages = Math.max(1, Math.ceil(result.rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const start = safePage * PAGE_SIZE;
  const visible = result.rows.slice(start, start + PAGE_SIZE);
  const pagerLabel =
    result.rows.length === 0 ? "0 / 0" : `${start + 1}–${start + visible.length} / ${result.rows.length}`;

  function change(next: SearchState) {
    setState(next);
    setPage(0);
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/feature-controls"
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          Edit limits
        </Link>
        <div className="min-w-0 flex-1">
          <OdooSearchBar
            scope="admin-ai-usage"
            state={state}
            onChange={change}
            quick={QUICK}
            fields={fieldFilters}
            groups={[]}
            placeholder="Search users, plans, tools"
            width="100%"
          />
        </div>
        <OdooPager
          label={pagerLabel}
          prev={{ onClick: () => setPage(Math.max(0, safePage - 1)), disabled: safePage === 0 }}
          next={{ onClick: () => setPage(Math.min(pages - 1, safePage + 1)), disabled: safePage >= pages - 1 }}
        />
      </div>

      <SearchCount result={result} noun="user and tool rows" className="mt-3" />

      {rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-7 text-center text-sm text-slate-600">
          No AI runs were logged in this period.
        </div>
      ) : result.rows.length === 0 ? (
        <div className="mt-3">
          <NoSearchMatches
            query={state.q || "these filters"}
            fields={SEARCH_FIELDS.map((f) => f.label)}
            onClear={() => change(EMPTY_SEARCH)}
          />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">Tool</th>
                <th className="px-4 py-2 font-medium">Runs and limit</th>
                <th className="px-4 py-2 font-medium">Cost</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => {
                const pct = r.maxRuns && r.maxRuns > 0 ? Math.min(100, (r.used / r.maxRuns) * 100) : 0;
                const bar = r.status === "over" || r.status === "at_limit" ? "bg-red-500" : r.status === "near" ? "bg-amber-500" : "bg-indigo-600";
                const meta = STATUS_META[r.status];
                return (
                  <tr key={r.key} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        <Highlight text={r.name} query={state.q} />
                      </div>
                      {r.email && r.email !== r.name ? (
                        <div className="text-xs text-slate-500">
                          <Highlight text={r.email} query={state.q} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <Highlight text={r.planLabel} query={state.q} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <Highlight text={r.featureLabel} query={state.q} />
                    </td>
                    <td className="px-4 py-3">
                      {r.maxRuns === null ? (
                        <span className="tabular-nums text-slate-700">
                          <Highlight text={String(r.used)} query={state.q} /> runs, no cap
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="tabular-nums text-slate-700">
                            {r.used} / {r.maxRuns} per {r.period}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {r.costUsd === null ? <span className="text-slate-400">Not logged</span> : usd(r.costUsd)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={statusLabel(r)} status={meta.tone} dot />
                      {r.resetAt ? <div className="mt-1 text-xs text-slate-500">Next run opens {dayLabel(r.resetAt)}</div> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
