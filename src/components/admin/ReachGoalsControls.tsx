"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REACH_GOAL_FIELDS, REACH_GOAL_MAX, type ReachGoalSection, type ReachGoalSet, type ReachGoals } from "@/lib/admin/reach-goals";

const SECTIONS: Array<{ key: ReachGoalSection; title: string }> = [
  { key: "intro", title: "Introductions" },
  { key: "auto", title: "Automated outreach" },
];
const LABELS: Record<keyof ReachGoalSet, string> = {
  sentWeek: "Sent per week",
  openedWeek: "Opened per week",
  sentMonth: "Sent per month",
  openedMonth: "Opened per month",
};

/**
 * Reach goals, on the admin Feature Controls page: weekly and monthly goals for
 * emails sent and opened, for Introductions and for Automated outreach. They
 * drive goal vs actual on the admin AI Agent page. An empty field is no goal.
 */
export function ReachGoalsControls() {
  const [goals, setGoals] = useState<ReachGoals | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/reach-goals")
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as { goals?: ReachGoals } | null;
        if (!active) return;
        if (r.ok && j?.goals) setGoals(j.goals);
        else setLoadError(true);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function set(section: ReachGoalSection, field: keyof ReachGoalSet, raw: string) {
    setMsg(null);
    const n = Math.round(Number(raw));
    const value = raw.trim() === "" || !Number.isFinite(n) || n < 1 ? null : Math.min(REACH_GOAL_MAX, n);
    setGoals((prev) => (prev ? { ...prev, [section]: { ...prev[section], [field]: value } } : prev));
  }

  async function save() {
    if (!goals) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/reach-goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goals),
      });
      const j = (await res.json().catch(() => ({}))) as { goals?: ReachGoals; error?: string };
      if (res.ok && j.goals) setGoals(j.goals);
      setMsg({ text: res.ok ? "Saved." : (j.error ?? "Could not save."), ok: res.ok });
    } catch {
      setMsg({ text: "Could not save.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Reach goals</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
            Weekly and monthly goals for emails sent and opened, across all companies. They drive goal vs actual on the{" "}
            <Link href="/admin/ai-agent" className="font-medium text-indigo-600 hover:text-indigo-700">AI Agent</Link> page. Leave a field empty for no goal.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg ? <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`} role="status">{msg.text}</span> : null}
          {goals ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save goals"}
            </button>
          ) : null}
        </div>
      </div>

      {loadError ? <p className="px-5 py-4 text-xs text-red-600">Could not load reach goals.</p> : null}
      {!goals && !loadError ? <p className="px-5 py-4 text-xs text-slate-500">Loading reach goals…</p> : null}

      {goals
        ? SECTIONS.map((s) => (
            <fieldset key={s.key} className="border-b border-slate-100 px-5 py-4 last:border-b-0">
              <legend className="float-left mb-3 w-full text-[13px] font-semibold text-slate-700">{s.title}</legend>
              <div className="clear-both grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {REACH_GOAL_FIELDS.map((f) => (
                  <label key={f} className="text-sm text-slate-700">
                    <span className="mb-1 block text-xs font-medium text-slate-500">{LABELS[f]}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={REACH_GOAL_MAX}
                      step={1}
                      placeholder="No goal"
                      value={goals[s.key][f] ?? ""}
                      onChange={(e) => set(s.key, f, e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-[#1A6CE4] focus:ring-2 focus:ring-[#1A6CE4]/20"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))
        : null}
    </section>
  );
}
