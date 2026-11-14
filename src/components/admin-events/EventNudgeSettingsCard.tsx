"use client";

import { useState } from "react";
import { NUDGE_START_DAYS } from "@/lib/icfo-events/event-notification-rules";

type Props = { initialEnabled: boolean; initialDays: number };

/** Admin control for the founder "Upcoming event" nudge: an on/off switch and how many days before. */
export function EventNudgeSettingsCard({ initialEnabled, initialDays }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [days, setDays] = useState(initialDays);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const options = [...NUDGE_START_DAYS].sort((a, b) => a - b);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/events/nudge-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, startDays: days }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: data.error ?? "Could not save." });
    } catch {
      setMsg({ ok: false, text: "Could not save." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5" aria-label="Founder event nudge">
      <h2 className="text-base font-semibold text-slate-900">Founder event nudge</h2>
      <p className="mt-1 text-sm text-slate-500">
        Controls the Upcoming event card founders see on Home and on Raise, Present at event.
      </p>

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Show the event nudge to founders</p>
          <p className="text-xs text-slate-500">Turn this off to hide the card everywhere. Dismissals are kept.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Show the event nudge to founders"
          onClick={() => setEnabled((v) => !v)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-blue-700" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-5" : "left-0.5"}`} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Start showing it</p>
          <p className="text-xs text-slate-500">How many days before the event the card first appears.</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          disabled={!enabled}
          aria-label="Days before the event"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
        >
          {options.map((d) => (
            <option key={d} value={d}>{d} days before</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`} role="status">{msg.text}</span>}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Founders who register for the event or dismiss the card no longer see it, whatever you set here.
      </p>
    </section>
  );
}
