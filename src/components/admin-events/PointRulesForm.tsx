"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { POINT_ACTION_LABELS } from "@/lib/icfo-events/gamification";
import type { PointAction } from "@/lib/icfo-events/gamification";

const ACTIONS = Object.keys(POINT_ACTION_LABELS) as PointAction[];

export function PointRulesForm({ initialRules }: { initialRules: Record<PointAction, number> }) {
  const t = useTranslations("adminCmp");
  const [rules, setRules] = useState<Record<PointAction, number>>(initialRules);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(action: PointAction, value: string) {
    const n = Math.max(0, Math.min(1000, Number(value) || 0));
    setRules((prev) => ({ ...prev, [action]: n }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/events/point-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Couldn't save.");
      if (json.rules) setRules(json.rules);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-panel)]">
      <div className="space-y-3">
        {ACTIONS.map((action) => (
          <label key={action} className="flex items-center justify-between gap-4">
            <span className="text-sm text-[var(--text-secondary)]">{POINT_ACTION_LABELS[action]}</span>
            <input
              type="number"
              min={0}
              max={1000}
              value={rules[action]}
              onChange={(e) => setValue(action, e.target.value)}
              className="w-24 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-right text-sm"
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-4 flex items-center gap-2">
        <button type="submit" disabled={busy} className="cap-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
          {busy ? "Saving…" : "Save points"}
        </button>
        {saved && <span className="text-xs text-emerald-700">{t("saved")}</span>}
      </div>
    </form>
  );
}
