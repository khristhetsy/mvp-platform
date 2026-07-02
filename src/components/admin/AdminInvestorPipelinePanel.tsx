"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  INVESTOR_PIPELINE_STAGES,
  filterAdminPipelineRows,
  type AdminInvestorPipelineRow,
  type InvestorPipelineStage,
} from "@/lib/investor-crm/admin-pipeline";
import { getCompanyWorkspaceHref } from "@/lib/ui/drilldown-links";

function formatStage(stage: string) {
  return stage
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ageDays(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

const STAGE_COLORS: Record<string, string> = {
  interested:        "bg-indigo-500",
  meeting_requested: "bg-violet-500",
  follow_up:         "bg-sky-500",
};

function StageSummaryBar({ rows }: { rows: AdminInvestorPipelineRow[] }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.stage] = (map[row.stage] ?? 0) + 1;
    }
    return map;
  }, [rows]);

  const total = rows.length;
  if (total === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Stage distribution · {total} relationship{total !== 1 ? "s" : ""}
      </p>
      {/* Stacked bar */}
      <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full">
        {INVESTOR_PIPELINE_STAGES.map((stage) => {
          const count = counts[stage] ?? 0;
          const pct = Math.round((count / total) * 100);
          if (pct === 0) return null;
          return (
            <div
              key={stage}
              className={`h-full ${STAGE_COLORS[stage] ?? "bg-slate-300"}`}
              style={{ width: `${pct}%` }}
              title={`${formatStage(stage)}: ${count}`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {INVESTOR_PIPELINE_STAGES.map((stage) => {
          const count = counts[stage] ?? 0;
          const dot = STAGE_COLORS[stage] ?? "bg-slate-300";
          return (
            <div key={stage} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
              <span>{formatStage(stage)}</span>
              <span className="font-semibold text-slate-900">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

type EditState = {
  stage: InvestorPipelineStage;
  probability: number;
  notes: string;
  nextFollowUpAt: string;
};

type Props = Readonly<{
  rows: AdminInvestorPipelineRow[];
  initialCompanyId?: string | null;
  initialInvestorId?: string | null;
}>;

export function AdminInvestorPipelinePanel({ rows, initialCompanyId, initialInvestorId }: Props) {
  const t = useTranslations("adminCmp");
  const [followUpDueOnly, setFollowUpDueOnly] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () =>
      filterAdminPipelineRows(rows, {
        followUpDueOnly,
        stage: stageFilter || undefined,
        companyId: initialCompanyId ?? undefined,
        investorId: initialInvestorId ?? undefined,
        q: search || undefined,
      }),
    [rows, followUpDueOnly, stageFilter, search, initialCompanyId, initialInvestorId],
  );

  const dueCount = useMemo(() => rows.filter((row) => row.follow_up_due).length, [rows]);

  function startEdit(row: AdminInvestorPipelineRow) {
    setEditingId(row.id);
    setEditState({
      stage: row.stage,
      probability: row.probability,
      notes: row.notes ?? "",
      nextFollowUpAt: row.next_follow_up_at ? row.next_follow_up_at.slice(0, 16) : "",
    });
    setMessage(null);
  }

  async function saveEdit(pipelineId: string) {
    if (!editState) {
      return;
    }

    setSaving(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      stage: editState.stage,
      probability: editState.probability,
      notes: editState.notes,
    };

    if (editState.nextFollowUpAt) {
      payload.nextFollowUpAt = new Date(editState.nextFollowUpAt).toISOString();
    } else {
      payload.clearFollowUp = true;
    }

    const res = await fetch(`/api/admin/investor-pipeline/${pipelineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setMessage(typeof body.error === "string" ? body.error : "Unable to save pipeline row.");
      return;
    }

    setMessage("Pipeline updated. Refresh the page to see latest values.");
    setEditingId(null);
    setEditState(null);
  }

  async function markContacted(pipelineId: string) {
    setSaving(true);
    setMessage(null);

    const res = await fetch(`/api/admin/investor-pipeline/${pipelineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markContacted: true }),
    });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setMessage(typeof body.error === "string" ? body.error : "Unable to mark contacted.");
      return;
    }

    setMessage("Marked as contacted. Refresh the page to see latest values.");
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{t("investor_pipeline")}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Staff follow-up tracking per investor–company pair ({rows.length} relationships
            {dueCount > 0 ? `, ${dueCount} follow-ups due` : ""}).
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={followUpDueOnly}
            onChange={(event) => setFollowUpDueOnly(event.target.checked)}
            className="rounded border-slate-300"
          />
          Due follow-ups only
        </label>
      </div>

      <StageSummaryBar rows={rows} />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder={t("search_investor_or_company")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All stages</option>
          {INVESTOR_PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {formatStage(stage)}
            </option>
          ))}
        </select>
      </div>

      {message ? <p className="mb-3 text-sm text-indigo-700">{message}</p> : null}

      <div className="divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">{t("no_pipeline_rows_match_these_filters")}</p>
        ) : (
          filtered.map((row) => {
            const investor = row.investor_name ?? row.investor_email ?? "Unknown investor";
            const editing = editingId === row.id && editState;

            return (
              <div key={row.id} className="py-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{investor}</p>
                  <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                    {formatStage(row.stage)} · {row.probability}%
                  </span>
                  {row.follow_up_due ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                      Follow-up due
                    </span>
                  ) : null}
                </div>

                <Link href={getCompanyWorkspaceHref(row.company_id)} className="text-indigo-700 hover:text-indigo-900">
                  {row.company_name ?? "Unknown company"}
                </Link>

                <dl className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  <div>
                    Last activity: {formatDate(row.last_activity_at)}
                    {(() => {
                      const d = ageDays(row.last_activity_at);
                      if (d == null) return null;
                      const cls = d >= 14 ? "text-red-600 font-semibold" : d >= 7 ? "text-amber-600" : "text-slate-400";
                      return <span className={`ml-1 ${cls}`}>({d}d ago)</span>;
                    })()}
                  </div>
                  <div>Last contacted: {formatDate(row.last_contacted_at)}</div>
                  <div>Next follow-up: {formatDate(row.next_follow_up_at)}</div>
                  <div>Owner: {row.owner_admin_name ?? "Unassigned"}</div>
                </dl>

                {row.notes && !editing ? <p className="mt-2 text-xs text-slate-600">Notes: {row.notes}</p> : null}

                {editing ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={editState.stage}
                        onChange={(event) =>
                          setEditState({ ...editState, stage: event.target.value as InvestorPipelineStage })
                        }
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                      >
                        {INVESTOR_PIPELINE_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {formatStage(stage)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editState.probability}
                        onChange={(event) =>
                          setEditState({ ...editState, probability: Number(event.target.value) })
                        }
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                        aria-label="Probability"
                      />
                      <input
                        type="datetime-local"
                        value={editState.nextFollowUpAt}
                        onChange={(event) =>
                          setEditState({ ...editState, nextFollowUpAt: event.target.value })
                        }
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    </div>
                    <textarea
                      value={editState.notes}
                      onChange={(event) => setEditState({ ...editState, notes: event.target.value })}
                      rows={2}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      placeholder={t("internal_notes")}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveEdit(row.id)}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditState(null);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => startEdit(row)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => markContacted(row.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Mark contacted
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
