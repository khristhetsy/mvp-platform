"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

export type PendingFounder = {
  profileId: string;
  fullName: string | null;
  email: string | null;
  companyName: string | null;
  requestedAt: string;
  readinessScore: number | null;
};

type ActionStatus = "idle" | "busy" | "approved" | "rejected" | "error";

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

type StageReviewResponse = {
  success: boolean;
  profile: { id: string; journey_stage: string; stage_approval_status: string | null };
};

export function AdminStageApprovalQueue({ founders }: { founders: PendingFounder[] }) {
  const t = useTranslations("billingCompaniesAdmin.stageQueue");
  const [statuses, setStatuses] = useState<Record<string, ActionStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [feedbackValues, setFeedbackValues] = useState<Record<string, string>>({});

  const applyAction = useCallback(
    async (profileId: string, action: "approve" | "reject", feedback?: string) => {
      setStatuses((prev) => ({ ...prev, [profileId]: "busy" }));
      setErrors((prev) => ({ ...prev, [profileId]: "" }));
      try {
        const res = await fetch(`/api/admin/stage-review/${profileId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, feedback }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        // Consume the response to satisfy exhaustive handling
        (await res.json()) as StageReviewResponse;
        setStatuses((prev) => ({
          ...prev,
          [profileId]: action === "approve" ? "approved" : "rejected",
        }));
        setRejectingId((prev) => (prev === profileId ? null : prev));
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [profileId]: err instanceof Error ? err.message : "Action failed",
        }));
        setStatuses((prev) => ({ ...prev, [profileId]: "error" }));
      }
    },
    [],
  );

  const handleRejectClick = useCallback((profileId: string) => {
    setRejectingId((prev) => (prev === profileId ? null : profileId));
  }, []);

  const handleFeedbackChange = useCallback((profileId: string, value: string) => {
    setFeedbackValues((prev) => ({ ...prev, [profileId]: value }));
  }, []);

  const handleRejectConfirm = useCallback(
    (profileId: string) => {
      void applyAction(profileId, "reject", feedbackValues[profileId] ?? "");
    },
    [applyAction, feedbackValues],
  );

  if (founders.length === 0) {
    return (
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-4 text-sm text-slate-500">{t("none")}</div>
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-400" />
          <h2 className="text-sm font-semibold text-indigo-900">
            {t("pending", { count: founders.length })}
          </h2>
        </div>
        <span className="text-xs text-indigo-600">{t("qualifyDeploy")}</span>
      </div>

      {/* Founder rows */}
      <div className="divide-y divide-slate-100">
        {founders.map((founder) => {
          const status = statuses[founder.profileId] ?? "idle";
          const isBusy = status === "busy";
          const isDone = status === "approved" || status === "rejected";
          const isRejecting = rejectingId === founder.profileId;

          return (
            <div
              key={founder.profileId}
              className={`px-5 py-3 ${isDone ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* Founder info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {founder.fullName ?? founder.email ?? t("unknownFounder")}
                    </span>
                    {isDone && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          status === "approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {status === "approved" ? t("approvedMoved") : t("rejectedSent")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {[
                      founder.companyName,
                      founder.requestedAt
                        ? t("requested", { date: formatDate(founder.requestedAt) ?? "" })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {founder.readinessScore != null && (
                      <span className="ml-2 text-indigo-500">
                        {t("ready", { score: founder.readinessScore })}
                      </span>
                    )}
                  </p>
                  {errors[founder.profileId] && (
                    <p className="mt-0.5 text-[11px] text-red-600">
                      {errors[founder.profileId]}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {!isDone && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void applyAction(founder.profileId, "approve")}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {isBusy && !isRejecting ? "…" : t("approve")}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRejectClick(founder.profileId)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      {t("reject")}
                    </button>
                  </div>
                )}
              </div>

              {/* Inline reject feedback */}
              {isRejecting && !isDone && (
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder={t("feedbackPh")}
                    value={feedbackValues[founder.profileId] ?? ""}
                    onChange={(e) => handleFeedbackChange(founder.profileId, e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isBusy || !(feedbackValues[founder.profileId] ?? "").trim()}
                      onClick={() => handleRejectConfirm(founder.profileId)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      {isBusy ? "…" : t("confirmRejection")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(null)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
