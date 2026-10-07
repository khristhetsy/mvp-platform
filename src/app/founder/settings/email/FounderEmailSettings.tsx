"use client";

import { useState } from "react";
import type { FounderEmailMode } from "@/lib/notifications/founder-email-budget/config";
import type { FounderEmailPrefs } from "@/lib/notifications/founder-email-budget/prefs";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

const OPTIONS: Array<{ id: FounderEmailMode; name: string; desc: string; recommended?: boolean }> = [
  { id: "instant", name: "Instant alerts only", desc: "Only the alerts listed below. No digests, no reminders." },
  { id: "daily", name: "Daily digest", desc: "One email a day with your next step and what changed. Skipped when nothing is new.", recommended: true },
  { id: "weekly", name: "Weekly summary", desc: "One email every Monday with your progress and updates." },
];

const ALWAYS = ["An investor replies to you", "An intro is accepted", "A meeting is booked or changed"];

function hourLabel(h: number): string {
  const suffix = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${suffix}`;
}

export function FounderEmailSettings({ initial, defaultSendHour }: Readonly<{ initial: FounderEmailPrefs; defaultSendHour: number }>) {
  const [mode, setMode] = useState<FounderEmailMode>(initial.mode);
  const [sendHour, setSendHour] = useState<number>(initial.sendHour ?? defaultSendHour);
  const [skipIfActive, setSkipIfActive] = useState(initial.skipIfActive);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Read on the server and in the browser alike, so the first render matches.
  const tz = initial.timezone ?? "your local time zone";

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const detectedTz = PLATFORM_TZ;
      const res = await fetch("/api/founder/email-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, sendHour, skipIfActive, timezone: detectedTz }),
      });
      if (!res.ok) throw new Error("Couldn't save. Try again.");
      setMessage({ tone: "ok", text: "Saved." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Couldn't save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {initial.downshiftFrom ? (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your recent {initial.downshiftFrom === "daily" ? "daily" : "weekly"} emails went unopened, so we sent you fewer. Pick what suits you below.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">How often</h2>
            <p className="mt-0.5 text-xs text-slate-500">Reminders and updates are collected into one email.</p>
          </div>
          <div className="flex items-center gap-3">
            {message ? <span className={`text-xs ${message.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span> : null}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-10 rounded-lg bg-[#1A6CE4] px-5 text-sm font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <fieldset className="grid grid-cols-1 gap-3 p-6 md:grid-cols-3">
          <legend className="sr-only">How often we email you</legend>
          {OPTIONS.map((o) => {
            const on = mode === o.id;
            return (
              <label
                key={o.id}
                className={`flex cursor-pointer flex-col gap-2 rounded-xl bg-white p-4 ${on ? "border-2 border-[#1A6CE4]" : "m-px border border-slate-200"}`}
              >
                <span className="flex items-center gap-2.5">
                  <input type="radio" name="email-mode" value={o.id} checked={on} onChange={() => { setMode(o.id); setMessage(null); }} className="h-4 w-4 accent-[#1A6CE4]" />
                  <span className="text-sm font-semibold text-slate-900">{o.name}</span>
                  {o.recommended ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#1A6CE4]">Recommended</span> : null}
                </span>
                <span className="text-xs leading-5 text-slate-500">{o.desc}</span>
              </label>
            );
          })}
        </fieldset>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Always sent right away</h2>
        </div>
        <ul className="px-6 py-2">
          {ALWAYS.map((a) => (
            <li key={a} className="flex items-center gap-3 border-b border-slate-100 py-3 text-sm text-slate-800 last:border-b-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A6B8C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <span className="flex-1">{a}</span>
              <span className="text-xs text-slate-500">Always on</span>
            </li>
          ))}
        </ul>
      </section>

      {mode !== "instant" ? (
        <section className="grid grid-cols-1 gap-6 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-2">
          <label htmlFor="email-send-hour" className="flex flex-col gap-2 text-sm font-semibold text-slate-900">
            Send time
            <select
              id="email-send-hour"
              value={sendHour}
              onChange={(e) => { setSendHour(Number(e.target.value)); setMessage(null); }}
              className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            >
              {Array.from({ length: 12 }, (_, i) => i + 7).map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
            <span className="text-xs font-normal text-slate-500">In {tz}{mode === "weekly" ? ", on Mondays" : ""}.</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={skipIfActive}
              onChange={(e) => { setSkipIfActive(e.target.checked); setMessage(null); }}
              className="mt-0.5 h-4 w-4 accent-[#1A6CE4]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-900">Skip the email if I have already been in iCapOS</span>
              <span className="text-xs text-slate-500">If you have seen your updates in the app since they arrived, that day&apos;s email waits.</span>
            </span>
          </label>
        </section>
      ) : null}
    </div>
  );
}
