"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionOrchestrationBadges } from "@/components/actions/ActionOrchestrationBadges";
import {
  priorityBadgeClass,
  statusBadgeClass,
} from "@/lib/next-best-actions/display";
import { actionCenterBasePath } from "@/lib/actions/filters";
import type { NextBestAction, NextBestActionRole } from "@/lib/next-best-actions/types";

type NextBestActionsPanelProps = {
  role: NextBestActionRole;
  initialActions?: NextBestAction[];
  contextPath?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  className?: string;
  showEscalate?: boolean;
  viewAllHref?: string;
  /** When true, hides complete/dismiss/snooze/escalate controls (view-only). */
  readOnly?: boolean;
};

type LifecycleAction = "complete" | "dismiss" | "snooze" | "escalate";
type ViewTab = "all" | "critical" | "overdue" | "escalated";

const VIEW_TABS: { id: ViewTab; labelKey: "tabAll" | "tabCritical" | "tabOverdue" | "tabEscalated" }[] = [
  { id: "all", labelKey: "tabAll" },
  { id: "critical", labelKey: "tabCritical" },
  { id: "overdue", labelKey: "tabOverdue" },
  { id: "escalated", labelKey: "tabEscalated" },
];

function filterByTab(actions: NextBestAction[], tab: ViewTab): NextBestAction[] {
  if (tab === "all") return actions;
  if (tab === "critical") return actions.filter((a) => a.priority === "critical");
  if (tab === "overdue") return actions.filter((a) => a.status === "overdue");
  if (tab === "escalated") return actions.filter((a) => a.status === "escalated");
  return actions;
}

export function NextBestActionsPanel({
  role,
  initialActions,
  contextPath,
  entityType,
  entityId,
  limit = 5,
  className = "",
  showEscalate = false,
  viewAllHref,
  readOnly = false,
}: Readonly<NextBestActionsPanelProps>) {
  const t = useTranslations("actions");
  const panelTitle =
    role === "investor" ? t("titleInvestor") : role === "admin" || role === "analyst" ? t("titleAdmin") : t("title");
  const allActionsHref = viewAllHref ?? actionCenterBasePath(role);
  const [actions, setActions] = useState<NextBestAction[]>(initialActions ?? []);
  const [loading, setLoading] = useState(!initialActions);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("all");

  const fetchActions = useCallback(async () => {
    const params = new URLSearchParams({ role, limit: String(limit), sync: "true" });
    if (contextPath) params.set("contextPath", contextPath);
    if (entityType) params.set("entityType", entityType);
    if (entityId) params.set("entityId", entityId);

    const response = await fetch(`/api/next-best-actions?${params.toString()}`);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? t("unableLoad"));
    }
    const data = (await response.json()) as { actions: NextBestAction[] };
    return data.actions ?? [];
  }, [role, limit, contextPath, entityType, entityId, t]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate or fetch next-best actions */
    if (initialActions) {
      setActions(initialActions);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchActions()
      .then((items) => {
        if (!cancelled) {
          setActions(items);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("unableLoad"));
          setActions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialActions, fetchActions, t]);

  async function runLifecycle(persistedId: string, lifecycle: LifecycleAction) {
    setPendingId(persistedId);
    setActionError(null);

    const previous = actions;
    if (lifecycle !== "snooze") {
      setActions((items) => items.filter((item) => item.persistedId !== persistedId));
    }

    try {
      const body: Record<string, string> = { action: lifecycle };
      if (lifecycle === "snooze") {
        body.snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }

      const response = await fetch(`/api/next-best-actions/${persistedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? t("unableUpdate"));
      }

      const refreshed = await fetchActions();
      setActions(refreshed);
    } catch (err) {
      setActions(previous);
      setActionError(err instanceof Error ? err.message : t("unableUpdate"));
    } finally {
      setPendingId(null);
    }
  }

  const canEscalate = showEscalate || role === "admin" || role === "analyst";

  const tabCounts = useMemo(
    () => ({
      all: actions.length,
      critical: actions.filter((a) => a.priority === "critical").length,
      overdue: actions.filter((a) => a.status === "overdue").length,
      escalated: actions.filter((a) => a.status === "escalated").length,
    }),
    [actions],
  );

  const visibleActions = useMemo(() => filterByTab(actions, activeTab), [actions, activeTab]);

  return (
    <section
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)] ${className}`}
      aria-label={panelTitle}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-950">{panelTitle}</h2>
            {readOnly ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t("viewOnly")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("subtitle")}</p>
        </div>
        <Link
          href={allActionsHref}
          className="shrink-0 text-xs font-semibold text-[var(--blue)] hover:text-[var(--blue-hover)]"
        >
          {t("viewAll")}
        </Link>
      </div>

      <div className="flex gap-1 border-b border-slate-100 px-4 pt-3 sm:px-5">
        {VIEW_TABS.map((tab) => {
          const count = tabCounts[tab.id];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-[var(--blue)] text-[var(--blue)]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t(tab.labelKey)}
              {count > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    isActive
                      ? "bg-[var(--blue-muted)] text-[var(--blue-hover)]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-4">
        {loading ? (
          <p className="text-sm text-slate-500" role="status" aria-live="polite">
            {t("loading")}
          </p>
        ) : error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : visibleActions.length === 0 ? (
          <p className="text-sm text-slate-600">
            {activeTab === "all" ? t("caughtUp") : t("noneInTab")}
          </p>
        ) : (
          <ul className="space-y-3">
            {visibleActions.map((action) => {
              const rowKey = action.persistedId ?? action.id;
              const isPending = pendingId === action.persistedId;

              return (
                <li
                  key={rowKey}
                  className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadgeClass(action.priority)}`}
                      >
                        {t(`priority.${action.priority}`)}
                      </span>
                      {action.status ? (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(action.status)}`}
                        >
                          {t(`status.${action.status}`)}
                        </span>
                      ) : null}
                      <ActionOrchestrationBadges action={action} />
                      <p className="text-sm font-medium text-slate-950">{action.title}</p>
                    </div>
                    {action.description ? (
                      <p className="mt-1 text-xs text-slate-600">{action.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">{action.reason}</p>
                    {action.dueAt ? (
                      <p className="mt-1 text-xs text-slate-600">
                        {t("suggestedDue", { date: new Date(action.dueAt).toLocaleString() })}
                      </p>
                    ) : null}
                    {action.blockers.length > 0 ? (
                      <p className="mt-1 text-xs text-amber-800">
                        {t("blockers", { items: action.blockers.slice(0, 3).join("; ") })}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={action.href}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--blue)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--blue-hover)]"
                    >
                      {t("open")}
                    </Link>
                    {action.persistedId && !readOnly ? (
                      <>
                        <button
                          type="button"
                          disabled={isPending}
                          aria-label={t("completeAria", { title: action.title })}
                          onClick={() => void runLifecycle(action.persistedId!, "complete")}
                          className="min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {t("complete")}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          aria-label={t("dismissAria", { title: action.title })}
                          onClick={() => void runLifecycle(action.persistedId!, "dismiss")}
                          className="min-h-11 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {t("dismiss")}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          aria-label={t("snoozeAria", { title: action.title })}
                          onClick={() => void runLifecycle(action.persistedId!, "snooze")}
                          className="min-h-11 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
                        >
                          {t("snooze")}
                        </button>
                        {canEscalate ? (
                          <button
                            type="button"
                            disabled={isPending}
                            aria-label={t("escalateAria", { title: action.title })}
                            onClick={() => void runLifecycle(action.persistedId!, "escalate")}
                            className="min-h-11 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {t("escalate")}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {actionError ? (
          <p className="mt-3 text-xs text-red-700" role="alert">
            {actionError}
          </p>
        ) : null}

        <p className="mt-4 text-[10px] leading-relaxed text-slate-500">{t("disclaimer")}</p>
      </div>
    </section>
  );
}
