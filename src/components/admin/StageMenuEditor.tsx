"use client";

import { useEffect, useMemo, useState } from "react";
import { ListChecks } from "lucide-react";

type StageGroup = { stage: string; items: { href: string; label: string }[] };

export function StageMenuEditor() {
  const [catalog, setCatalog] = useState<StageGroup[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/founder-stage-menu");
        const j = await res.json();
        if (res.ok) {
          setCatalog(j.catalog ?? []);
          setHidden(new Set<string>(j.hidden ?? []));
          setActiveStage((j.catalog?.[0] as StageGroup | undefined)?.stage ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = useMemo(() => catalog.find((g) => g.stage === activeStage) ?? null, [catalog, activeStage]);
  const shownCount = (g: StageGroup) => g.items.filter((i) => !hidden.has(i.href)).length;

  function toggle(href: string) {
    setMsg(null);
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/founder-stage-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: [...hidden] }),
      });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? "Saved. Founder menus updated." : j.error ?? "Could not save.");
    } catch {
      setMsg("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;
  if (catalog.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <ListChecks className="h-5 w-5 text-[var(--gold,#B8860B)]" strokeWidth={1.75} aria-hidden /> Stage menus
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Choose which menu items appear under each founder stage. Unchecked items are hidden from that stage for all
        founders. (Applies to the 4-step founder nav.)
      </p>

      {msg && (
        <p
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
            msg.startsWith("Saved") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {msg}
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[210px_1fr]">
        {/* Stage rail */}
        <div className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white">
          {catalog.map((g) => {
            const on = g.stage === activeStage;
            return (
              <button
                key={g.stage}
                onClick={() => setActiveStage(g.stage)}
                className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-0 ${
                  on ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{g.stage}</span>
                <span className={`text-xs ${on ? "text-indigo-500" : "text-slate-400"}`}>
                  {shownCount(g)} / {g.items.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Checklist for the active stage */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {active?.stage} · menu items
            </span>
            {active && (
              <span className="text-xs text-slate-400">
                {shownCount(active)} of {active.items.length} shown
              </span>
            )}
          </div>
          {active?.items.map((item) => {
            const shown = !hidden.has(item.href);
            return (
              <label
                key={item.href}
                className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-sm last:border-0 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() => toggle(item.href)}
                  className="h-4 w-4 accent-[#1D9E75]"
                />
                <span className={shown ? "text-slate-900" : "text-slate-400"}>{item.label}</span>
                <span className="ml-auto text-[11px] text-slate-300">{item.href}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-[#1D9E75] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}
