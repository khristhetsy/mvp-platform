"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Check } from "lucide-react";
import type { AvailabilitySettings, WeeklyRule } from "@/lib/scheduling/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

type DayState = { enabled: boolean; start: string; end: string };

function minToHM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function rulesToDays(rules: WeeklyRule[]): DayState[] {
  return DAYS.map((_, weekday) => {
    const rule = rules.find((r) => r.weekday === weekday);
    return rule
      ? { enabled: true, start: minToHM(rule.startMinute), end: minToHM(rule.endMinute) }
      : { enabled: false, start: "09:00", end: "17:00" };
  });
}

export function AvailabilityEditor({ bookingPath }: { bookingPath?: string }) {
  const [days, setDays] = useState<DayState[]>(() => rulesToDays([]));
  const [timezone, setTimezone] = useState(LOCAL_TZ);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  // Resolve the app origin client-side so the booking link is a full shareable URL.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const bookingUrl = bookingPath ? `${origin}${bookingPath}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — user can still select the text
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scheduling/availability");
      const data = await res.json();
      const s: AvailabilitySettings | undefined = data.settings;
      if (s) {
        setDays(rulesToDays(s.weeklyRules ?? []));
        setTimezone(s.timezone || LOCAL_TZ);
        setSlotMinutes(s.slotMinutes ?? 30);
        setBufferMinutes(s.bufferMinutes ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      const weeklyRules: WeeklyRule[] = days
        .map((d, weekday) => ({ d, weekday }))
        .filter(({ d }) => d.enabled && hmToMin(d.end) > hmToMin(d.start))
        .map(({ d, weekday }) => ({ weekday, startMinute: hmToMin(d.start), endMinute: hmToMin(d.end) }));
      const res = await fetch("/api/scheduling/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, slotMinutes, bufferMinutes, weeklyRules }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Save failed.");
      }
      setMsg("Availability saved.");
      setTimeout(() => setMsg(null), 2500);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [days, timezone, slotMinutes, bufferMinutes]);

  const setDay = (i: number, patch: Partial<DayState>) =>
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  if (loading) return <p className="text-sm text-slate-500">Loading availability…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950">
          <Clock className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.75} aria-hidden /> Scheduling
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Set the hours you&apos;re open for meetings. People you share your link with can book any open slot, and it lands on your calendar with a Google Meet link.
        </p>
      </div>

      {bookingPath ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] px-3 py-2 text-sm text-[#0C447C]">
          <span className="font-medium">Your booking link:</span>
          <a href={bookingPath} className="truncate rounded bg-white/70 px-2 py-0.5 text-xs underline-offset-2 hover:underline">
            {bookingUrl || bookingPath}
          </a>
          <button
            type="button"
            onClick={() => void copyLink()}
            disabled={!bookingUrl}
            className="rounded-md border border-[#85B7EB] bg-white px-2 py-0.5 text-xs font-medium text-[#0C447C] hover:bg-[#E6F1FB] disabled:opacity-50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : null}

      {msg ? (
        <p className={`rounded-lg border px-3 py-2 text-sm ${msg.includes("saved") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>{msg}</p>
      ) : null}

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
        <div className="mb-4 flex flex-wrap gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Timezone</span>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Slot length</span>
            <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              {[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n} min</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Buffer between</span>
            <select value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              {[0, 5, 10, 15, 30].map((n) => <option key={n} value={n}>{n} min</option>)}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          {days.map((d, i) => (
            <div key={DAYS[i]} className="flex items-center gap-3">
              <label className="flex w-32 items-center gap-2 text-sm">
                <input type="checkbox" checked={d.enabled} onChange={(e) => setDay(i, { enabled: e.target.checked })} className="h-4 w-4 rounded" />
                {DAYS[i]}
              </label>
              {d.enabled ? (
                <div className="flex items-center gap-2 text-sm">
                  <input type="time" value={d.start} onChange={(e) => setDay(i, { start: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                  <span className="text-slate-400">to</span>
                  <input type="time" value={d.end} onChange={(e) => setDay(i, { end: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                </div>
              ) : (
                <span className="text-sm text-slate-400">Unavailable</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save availability"}
          </button>
        </div>
      </div>
    </div>
  );
}
