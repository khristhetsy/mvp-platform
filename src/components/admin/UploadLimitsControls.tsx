"use client";

import { useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";

type Limits = { maxMb: number; maxPages: number };

export function UploadLimitsControls() {
  const [limits, setLimits] = useState<Limits | null>(null);
  const [ceiling, setCeiling] = useState<Limits>({ maxMb: 32, maxPages: 100 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/upload-limits");
        if (!res.ok) return;
        const j = await res.json();
        if (!active) return;
        setLimits(j.limits ?? null);
        if (j.ceiling) setCeiling(j.ceiling);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  function set(patch: Partial<Limits>) {
    setMsg(null);
    setLimits((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function save() {
    if (!limits) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/upload-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(limits),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.limits) setLimits(j.limits);
      setMsg({ text: res.ok ? "Saved. Applies to new uploads immediately." : (j.error ?? "Could not save."), ok: res.ok });
    } catch {
      setMsg({ text: "Could not save.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !limits) return null;

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <UploadCloud className="h-5 w-5 text-[var(--gold,#B8860B)]" strokeWidth={1.75} aria-hidden /> Upload limits
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Caps on every founder document upload. Keeping decks light keeps the AI analyzer fast and reliable.
        Enforced in the browser and on the server. Ceilings: {ceiling.maxMb} MB, {ceiling.maxPages} pages.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-medium text-slate-900">Founder documents</span>
          <div className="flex items-center gap-3">
            {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save limits"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Max file size</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={ceiling.maxMb}
                value={limits.maxMb}
                onChange={(e) => set({ maxMb: Math.max(1, Math.min(ceiling.maxMb, Math.round(Number(e.target.value) || 0))) })}
                className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <span className="text-slate-500">MB</span>
            </span>
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Max PDF pages</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={ceiling.maxPages}
                value={limits.maxPages}
                onChange={(e) => set({ maxPages: Math.max(1, Math.min(ceiling.maxPages, Math.round(Number(e.target.value) || 0))) })}
                className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <span className="text-slate-500">pages</span>
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
