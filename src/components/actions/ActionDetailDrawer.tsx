"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionPriorityBadge } from "@/components/actions/ActionPriorityBadge";
import { ActionStatusBadge } from "@/components/actions/ActionStatusBadge";
import { ActionTimeline } from "@/components/actions/ActionTimeline";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";
import { DraftEmailPanel } from "@/components/email/DraftEmailPanel";
import type { ActionCenterDetail } from "@/lib/actions/types";
import { NBA_DISCLAIMER } from "@/lib/next-best-actions/types";

type LifecycleAction = "complete" | "dismiss" | "snooze" | "reopen" | "escalate";

export function ActionDetailDrawer({
  actionId,
  canEscalate,
  viewerRole = "admin",
  onClose,
  onUpdated,
}: Readonly<{
  actionId: string | null;
  canEscalate: boolean;
  viewerRole?: "founder" | "investor" | "admin" | "analyst";
  onClose: () => void;
  onUpdated: () => void;
}>) {
  const [detail, setDetail] = useState<ActionCenterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- load drawer detail when actionId changes */
    if (!actionId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetch(`/api/action-center/${actionId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to load action detail.");
        return res.json() as Promise<ActionCenterDetail>;
      })
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [actionId]);

  if (!actionId) return null;

  async function runLifecycle(lifecycle: LifecycleAction) {
    if (!actionId) return;
    setPending(true);
    setError(null);
    try {
      const body: Record<string, string> = { action: lifecycle };
      if (lifecycle === "snooze") {
        body.snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
      const res = await fetch(`/api/next-best-actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Update failed.");
      }
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setPending(false);
    }
  }

  const action = detail?.action;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-label="Close drawer" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-detail-title"
        className="relative z-10 flex w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        style={{ maxWidth: 448, maxHeight: 536 }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="action-detail-title" className="text-sm font-semibold text-slate-950">Action detail</h2>
          <button type="button" onClick={onClose} aria-label="Close action detail" className="text-sm text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : action ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <ActionPriorityBadge priority={action.priority} />
                <ActionStatusBadge status={action.status} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">{action.title}</h3>
              {action.description ? <p className="text-sm text-slate-600">{action.description}</p> : null}
              <p className="text-sm text-slate-500">{action.reason}</p>

              {action.blockers.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Blockers</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-amber-900">
                    {action.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Category</dt>
                  <dd className="font-medium text-slate-800">{action.category.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Source</dt>
                  <dd className="font-medium text-slate-800">{action.sourceModule}</dd>
                </div>
                {action.dueAt ? (
                  <div>
                    <dt className="text-slate-500">Due</dt>
                    <dd className="font-medium text-slate-800">{new Date(action.dueAt).toLocaleString()}</dd>
                  </div>
                ) : null}
                {action.entityType ? (
                  <div>
                    <dt className="text-slate-500">Entity</dt>
                    <dd className="font-medium text-slate-800">{action.entityType}</dd>
                  </div>
                ) : null}
              </dl>

              <DraftEmailPanel
                role={viewerRole}
                entityType={action.entityType ?? undefined}
                entityId={action.entityId ?? undefined}
                sourceActionId={action.persistedId ?? actionId}
                compact
              />

              <div className="flex flex-wrap gap-2">
                <Link href={action.href} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">
                  Open workflow
                </Link>
                {detail?.workspaceHref ? (
                  <Link
                    href={detail.workspaceHref}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Entity workspace
                  </Link>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Operational timeline</p>
                <ActionTimeline items={detail?.timeline ?? []} />
              </div>

              {action.persistedId ? (
                <CollaborationDiscussionPanel
                  entityType="action"
                  entityId={action.persistedId}
                  title="Action discussion"
                />
              ) : null}

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void runLifecycle("complete")}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Complete
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void runLifecycle("dismiss")}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void runLifecycle("snooze")}
                  className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 disabled:opacity-50"
                >
                  Snooze
                </button>
                {action.status !== "open" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void runLifecycle("reopen")}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    Reopen
                  </button>
                ) : null}
                {canEscalate ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void runLifecycle("escalate")}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-50"
                  >
                    Escalate
                  </button>
                ) : null}
              </div>

              <p className="text-[10px] text-slate-500">{NBA_DISCLAIMER}</p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
