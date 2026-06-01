"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatPriorityLabel,
  panelTitleForRole,
  priorityBadgeClass,
} from "@/lib/next-best-actions/display";
import { NBA_DISCLAIMER } from "@/lib/next-best-actions/types";
import type { NextBestAction, NextBestActionRole } from "@/lib/next-best-actions/types";

type NextBestActionsPanelProps = {
  role: NextBestActionRole;
  /** Server-rendered actions; when omitted the panel fetches from the API. */
  initialActions?: NextBestAction[];
  contextPath?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  className?: string;
};

export function NextBestActionsPanel({
  role,
  initialActions,
  contextPath,
  entityType,
  entityId,
  limit = 5,
  className = "",
}: Readonly<NextBestActionsPanelProps>) {
  const [actions, setActions] = useState<NextBestAction[]>(initialActions ?? []);
  const [loading, setLoading] = useState(!initialActions);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialActions) {
      setActions(initialActions);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ role, limit: String(limit) });
    if (contextPath) params.set("contextPath", contextPath);
    if (entityType) params.set("entityType", entityType);
    if (entityId) params.set("entityId", entityId);

    let cancelled = false;
    setLoading(true);

    fetch(`/api/next-best-actions?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Unable to load actions.");
        }
        return response.json() as Promise<{ actions: NextBestAction[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setActions(data.actions ?? []);
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
  }, [initialActions, role, contextPath, entityType, entityId, limit]);

  return (
    <section
      className={`rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)] ${className}`}
      aria-label={panelTitleForRole(role)}
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-[var(--navy)]">{panelTitleForRole(role)}</h2>
        <p className="mt-1 text-xs text-slate-500">Prioritized from your current workspace state</p>
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
            {actions.map((action) => (
              <li
                key={action.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadgeClass(action.priority)}`}
                    >
                      {formatPriorityLabel(action.priority)}
                    </span>
                    <p className="text-sm font-medium text-[var(--navy)]">{action.title}</p>
                  </div>
                  {action.description ? (
                    <p className="mt-1 text-xs text-slate-600">{action.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">{action.reason}</p>
                  {action.blockers.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-800">
                      Blockers: {action.blockers.slice(0, 3).join("; ")}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={action.href}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-slate-400">{NBA_DISCLAIMER}</p>
      </div>
    </section>
  );
}
