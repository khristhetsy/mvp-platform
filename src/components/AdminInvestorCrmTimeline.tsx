"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Trash2, Loader2 } from "lucide-react";
import type { AdminCrmActivityRow } from "@/lib/data/investor-crm";
import { getCompanyWorkspaceHref } from "@/lib/ui/drilldown-links";

function formatActivityLabel(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

type Props = {
  activities: AdminCrmActivityRow[];
  canDelete?: boolean;
};

export function AdminInvestorCrmTimeline({ activities, canDelete = false }: Props) {
  const t = useTranslations("sharedCmp");
  const [rows, setRows] = useState<AdminCrmActivityRow[]>(activities);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteOne(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/crm/activity?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError(t("action_failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function clearAll() {
    if (!window.confirm(t("confirm_clear_all_activity"))) return;
    setClearing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/crm/activity?all=1`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRows([]);
    } catch {
      setError(t("action_failed"));
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{t("recent_activity")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("latest_investor_actions_tracked_for_pipeline")}</p>
        </div>
        {canDelete && rows.length > 0 && (
          <button
            onClick={clearAll}
            disabled={clearing}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t("clear_all")}
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      <div className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">{t("no_crm_activity_logged_yet")}</p>
        ) : (
          rows.map((row) => {
            const investor = row.investor_name ?? row.investor_email ?? "Unknown investor";
            return (
              <div key={row.id} className="group flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{investor}</p>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                      {formatActivityLabel(row.activity_type)}
                    </span>
                    {row.pipeline_stage ? (
                      <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                        Pipeline: {formatActivityLabel(row.pipeline_stage)}
                      </span>
                    ) : null}
                  </div>
                  {row.company_id ? (
                    <Link href={getCompanyWorkspaceHref(row.company_id)} className="text-indigo-700 hover:text-indigo-900">
                      {row.company_name ?? "Unknown company"}
                    </Link>
                  ) : (
                    <p className="text-slate-600">{row.company_name ?? "Unknown company"}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{formatDate(row.created_at)}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => deleteOne(row.id)}
                    disabled={busyId === row.id}
                    aria-label={t("delete_activity")}
                    className="mt-0.5 shrink-0 rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
