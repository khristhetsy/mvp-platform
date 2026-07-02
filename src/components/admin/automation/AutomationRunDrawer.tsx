"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { AutomationRunDetail } from "@/lib/automation/admin-console-types";
import { AutomationActionList } from "@/components/admin/automation/AutomationActionList";
import { AutomationFailurePanel } from "@/components/admin/automation/AutomationFailurePanel";
import { AutomationStatusBadge } from "@/components/admin/automation/AutomationStatusBadge";
import { AutomationTriggerBadge } from "@/components/admin/automation/AutomationTriggerBadge";

export function AutomationRunDrawer({
  runId,
  onClose,
}: Readonly<{ runId: string | null; onClose: () => void }>) {
  const t = useTranslations("adminCmp");
  const [detail, setDetail] = useState<AutomationRunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- load automation run detail when runId changes */
    if (!runId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetch(`/api/admin/automation/runs/${runId}`)
      .then(async (res) => {
        if (res.status === 401) throw new Error("Session expired. Sign in again.");
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? "Unable to load run detail.");
        }
        return res.json() as Promise<AutomationRunDetail>;
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
  }, [runId]);

  if (!runId) return null;

  const entityHref =
    detail?.entityType === "company" && detail.entityId
      ? `/admin/companies/${detail.entityId}`
      : detail?.entityType === "spv"
        ? "/admin/spvs"
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="automation-run-title"
    >
      <button type="button" className="flex-1" aria-label="Close drawer" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id="automation-run-title" className="text-sm font-semibold text-slate-950">{t("automation_run")}</h2>
          <button type="button" onClick={onClose} className="text-xs font-medium text-slate-600 hover:text-slate-950">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? <p className="text-sm text-slate-600">{t("loading")}</p> : null}
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900" role="alert">
              {error}
            </p>
          ) : null}
          {detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <AutomationStatusBadge status={detail.status} />
                <AutomationTriggerBadge trigger={detail.triggerType} />
                {detail.dryRun ? (
                  <span className="text-[10px] font-semibold uppercase text-slate-500">{t("dry_run")}</span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase text-indigo-700">{t("live")}</span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Started</dt>
                  <dd>{new Date(detail.startedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Duration</dt>
                  <dd className="font-mono">{detail.durationMs ?? 0}ms</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Actions created</dt>
                  <dd className="font-mono">{detail.actionsExecuted}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Skipped rules</dt>
                  <dd className="font-mono">{detail.actionsSkipped}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Blockers</dt>
                  <dd className="font-mono">{detail.blockersDetected}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Deps resolved</dt>
                  <dd className="font-mono">{detail.dependenciesResolved}</dd>
                </div>
              </dl>
              {entityHref ? (
                <Link href={entityHref} className="text-xs font-semibold text-indigo-700 hover:underline">
                  Open related {detail.entityType} workspace
                </Link>
              ) : null}
              <AutomationFailurePanel metadata={detail.metadata} />
              <section>
                <h3 className="text-xs font-semibold uppercase text-slate-500">{t("rules_triggered")}</h3>
                <ul className="mt-2 space-y-1 text-xs">
                  {(detail.metadata.results ?? []).map((r) => (
                    <li key={r.ruleId} className="flex justify-between gap-2">
                      <span className="font-mono">{r.ruleId}</span>
                      <span>{r.status}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase text-slate-500">{t("actions_executed")}</h3>
                <div className="mt-2">
                  <AutomationActionList actions={detail.actions} />
                </div>
              </section>
              {detail.relatedEvents.length > 0 ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-slate-500">{t("operational_events")}</h3>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {detail.relatedEvents.map((e) => (
                      <li key={e.id}>
                        {e.title} · <span className="font-mono">{e.eventType}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
