"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

type PendingCompany = {
  id: string;
  company_name: string;
  review_status: string | null;
  created_at?: string | null;
  readinessScore?: number | null;
  industry?: string | null;
};

type ActionStatus = "idle" | "busy" | "approved" | "rejected" | "error";

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function AdminPendingQuickReview({ companies }: { companies: PendingCompany[] }) {
  const t = useTranslations("billingCompaniesAdmin.quickReview");
  const [statuses, setStatuses] = useState<Record<string, ActionStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const applyAction = useCallback(async (id: string, action: "approve" | "reject") => {
    setStatuses((prev) => ({ ...prev, [id]: "busy" }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/companies/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setStatuses((prev) => ({
        ...prev,
        [id]: action === "approve" ? "approved" : "rejected",
      }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Action failed",
      }));
      setStatuses((prev) => ({ ...prev, [id]: "error" }));
    }
  }, []);

  const pending = companies.filter(
    (c) => !statuses[c.id] || statuses[c.id] === "idle" || statuses[c.id] === "error",
  );

  if (companies.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <h2 className="text-sm font-semibold text-amber-900">
            {t("pending", { count: pending.length })}
          </h2>
        </div>
        <Link
          href="/admin/companies"
          className="text-xs font-semibold text-amber-700 hover:text-amber-900"
        >
          {t("viewAll")}
        </Link>
      </div>

      {/* Company rows */}
      <div className="divide-y divide-slate-100">
        {companies.map((company) => {
          const status = statuses[company.id] ?? "idle";
          const isBusy = status === "busy";
          const isDone = status === "approved" || status === "rejected";

          return (
            <div
              key={company.id}
              className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${isDone ? "opacity-60" : ""}`}
            >
              {/* Company info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/companies/${company.id}`}
                    className="truncate text-sm font-semibold text-slate-900 hover:text-indigo-700"
                  >
                    {company.company_name}
                  </Link>
                  {isDone && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        status === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {status === "approved" ? t("approved") : t("rejected")}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {[company.industry, formatDate(company.created_at) ? t("submitted", { date: formatDate(company.created_at) ?? "" }) : null]
                    .filter(Boolean)
                    .join(" · ")}
                  {company.readinessScore != null && (
                    <span className="ml-2 text-indigo-500">{t("ready", { score: company.readinessScore })}</span>
                  )}
                </p>
                {errors[company.id] && (
                  <p className="mt-0.5 text-[11px] text-red-600">{errors[company.id]}</p>
                )}
              </div>

              {/* Actions */}
              {!isDone && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void applyAction(company.id, "approve")}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {isBusy ? "…" : t("approve")}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void applyAction(company.id, "reject")}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    {t("reject")}
                  </button>
                  <Link
                    href={`/admin/companies/${company.id}`}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    {t("review")}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
