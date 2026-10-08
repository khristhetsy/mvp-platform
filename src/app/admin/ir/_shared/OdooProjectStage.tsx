"use client";

/**
 * The Odoo project stage bar on Investor Relations project and task pages.
 * Shows the linked Odoo project's Stage bar (with time in stage, like "14d")
 * and its Status bar. Clicking a step moves the project in Odoo, the same as
 * clicking it there. Hidden when the project has no Odoo link or Odoo is unreachable.
 */
import { useCallback, useEffect, useState } from "react";
import { OdooStageBar } from "@/components/ui/OdooStageBar";
import { durationLabel, splitSteps } from "@/lib/ir/odoo-stage-format";

type Step = { key: string; label: string; folded: boolean; seconds: number | null };
type Bar = { field: string; label: string; steps: Step[]; current: string | null };
type Data = { linked: true; projects: Array<{ id: number; name: string }>; projectId: number; stage: Bar | null; status: Bar | null } | { linked: false };

export function BarWithMore({ bar, max, busy, onPick }: { bar: Bar; max: number; busy: boolean; onPick: (field: string, key: string) => void }) {
  const [open, setOpen] = useState(false);
  const { shown, more } = splitSteps(bar.steps, bar.current, max);
  const curIdx = bar.steps.findIndex((s) => s.key === bar.current);
  return (
    <div className="flex min-w-0 items-center">
      <OdooStageBar
        size="sm"
        ariaLabel={`Odoo ${bar.label}`}
        current={bar.current}
        disabled={busy}
        onSelect={(key) => onPick(bar.field, key)}
        steps={shown.map((s) => {
          const i = bar.steps.findIndex((x) => x.key === s.key);
          return {
            key: s.key,
            label: s.label,
            hint: durationLabel(s.seconds),
            state: s.key === bar.current ? "on" : curIdx >= 0 && i < curIdx ? "done" : "todo",
            title: `Move to ${s.label} in Odoo`,
          };
        })}
      />
      {more.length ? (
        <div className="relative ml-1 flex-none">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={`More ${bar.label.toLowerCase()} options`}
            aria-expanded={open}
            disabled={busy}
            className="h-[26px] rounded-r-md bg-[#F3F5F8] px-2.5 text-[12px] text-[#5a6b87] hover:bg-[#E3E9F1]"
          >
            ···
          </button>
          {open ? (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-30 mt-1 max-h-72 w-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-[12.5px] shadow-lg">
                {more.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onPick(bar.field, s.key);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                  >
                    {s.label}
                    {durationLabel(s.seconds) ? <span className="text-[11px] text-slate-400">{durationLabel(s.seconds)}</span> : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function OdooProjectStage({ projectId, className = "" }: { projectId: string; className?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBar = useCallback(
    (wanted: number | null) =>
      fetch(`/api/admin/ir/projects/${projectId}/odoo-stage${wanted ? `?odooProjectId=${wanted}` : ""}`)
        .then((r) => (r.ok ? (r.json() as Promise<Data>) : ({ linked: false } as Data)))
        .catch(() => ({ linked: false }) as Data),
    [projectId],
  );

  // Load once per project; Odoo is read after the page renders so it never slows it.
  useEffect(() => {
    let active = true;
    void fetchBar(null).then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, [fetchBar]);

  const switchProject = (id: number) => {
    void fetchBar(id).then(setData);
  };

  if (!data || !data.linked || (!data.stage && !data.status)) return null;

  const pick = async (field: string, value: string) => {
    if (busy) return;
    const prev = data;
    // Optimistic: move the bar right away, roll back if Odoo refuses.
    setData({
      ...data,
      stage: data.stage && field === data.stage.field ? { ...data.stage, current: value } : data.stage,
      status: data.status && field === data.status.field ? { ...data.status, current: value } : data.status,
    });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ir/projects/${projectId}/odoo-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odooProjectId: data.projectId, field, value }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Couldn't update the stage in Odoo.");
      if (json?.linked) setData(json as Data);
    } catch (e) {
      setData(prev);
      setError(e instanceof Error ? e.message : "Couldn't update the stage in Odoo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
        <i className="ti ti-refresh" aria-hidden="true" />
        <span>Project stage, from Odoo</span>
        {data.projects.length > 1 ? (
          <select
            value={data.projectId}
            onChange={(e) => switchProject(Number(e.target.value))}
            aria-label="Odoo project"
            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11.5px] text-slate-700"
          >
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-slate-700">{data.projects[0]?.name}</span>
        )}
        {busy ? <span className="text-slate-400">Saving to Odoo…</span> : null}
        {error ? <span className="text-rose-600">{error}</span> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {data.stage ? <BarWithMore bar={data.stage} max={8} busy={busy} onPick={pick} /> : <span />}
        {data.status ? <BarWithMore bar={data.status} max={3} busy={busy} onPick={pick} /> : null}
      </div>
    </div>
  );
}
