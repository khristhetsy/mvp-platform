"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  formatPriorityLabel,
  formatStatusLabel,
  panelTitleForRole,
  priorityBadgeClass,
  statusBadgeClass,
} from "@/lib/next-best-actions/display";
import { NBA_DISCLAIMER } from "@/lib/next-best-actions/types";
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
};

type LifecycleAction = "complete" | "dismiss" | "snooze" | "escalate";

export function NextBestActionsPanel({
  role,
  initialActions,
  contextPath,
  entityType,
  entityId,
  limit = 5,
  className = "",
  showEscalate = false,
}: Readonly<NextBestActionsPanelProps>) {
  const [actions, setActions] = useState<NextBestAction[]>(initialActions ?? []);
  const [loading, setLoading] = useState(!initialActions);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchActions = useCallback(async () => {
    const params = new URLSearchParams({ role, limit: String(limit), sync: "true" });
    if (contextPath) params.set("contextPath", contextPath);
    if (entityType) params.set("entityType", entityType);
    if (entityId) params.set("entityId", entityId);

    const response = await fetch(`/api/next-best-actions?${params.toString()}`);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Unable to load actions.");
    }
    const data = (await response.json()) as { actions: NextBestAction[] };
    return data.actions ?? [];
  }, [role, limit, contextPath, entityType, entityId]);

  useEffect(() => {
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
          setError(err instanceof Error ? err.message : "Unable to load actions.");
          setActions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialActions, fetchActions]);

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
        throw new Error(payload.error ?? "Unable to update action.");
      }

      const refreshed = await fetchActions();
      setActions(refreshed);
    } catch (err) {
      setActions(previous);
      setActionError(err instanceof Error ? err.message : "Unable to update action.");
    } finally {
      setPendingId(null);
    }
  }

  const canEscalate = showEscalate || role === "admin" || role === "analyst";

  return (
    <section
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)] ${className}`}
      aria-label={panelTitleForRole(role)}
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-[var(--navy)]">{panelTitleForRole(role)}</h2>
        <p className="mt-1 text-xs text-slate-500">Prioritized workflow actions with lifecycle tracking</p>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading suggested actions…</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : actions.length === 0 ? (
          <p className="text-sm text-slate-600">
            You are caught up on prioritized items. Check back as your workflow state changes.
          </p>
        ) : (
          <ul className="space-y-3">
            {actions.map((action) => {
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
                        {formatPriorityLabel(action.priority)}
                      </span>
                      {action.status ? (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(action.status)}`}
                        >
                          {formatStatusLabel(action.status)}
                        </span>
                      ) : null}
                      <p className="text-sm font-medium text-[var(--navy)]">{action.title}</p>
                    </div>
                    {action.description ? (
                      <p className="mt-1 text-xs text-slate-600">{action.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">{action.reason}</p>
                    {action.dueAt ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Suggested due: {new Date(action.dueAt).toLocaleString()}
                      </p>
                    ) : null}
                    {action.blockers.length > 0 ? (
                      <p className="mt-1 text-xs text-amber-800">
                        Blockers: {action.blockers.slice(0, 3).join("; ")}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={action.href}
                      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Open
                    </Link>
                    {action.persistedId ? (
                      <>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => void runLifecycle(action.persistedId!, "complete")}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => void runLifecycle(action.persistedId!, "dismiss")}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => void runLifecycle(action.persistedId!, "snooze")}
                          className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
                        >
                          Snooze 24h
                        </button>
                        {canEscalate ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => void runLifecycle(action.persistedId!, "escalate")}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                          >
                            Escalate
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

        {actionError ? <p className="mt-3 text-xs text-red-700">{actionError}</p> : null}

        <p className="mt-4 text-[10px] leading-relaxed text-slate-400">{NBA_DISCLAIMER}</p>
      </div>
    </section>
  );
}
