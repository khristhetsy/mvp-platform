"use client";

import { useState } from "react";
import { X, Loader2, CalendarPlus, Check } from "lucide-react";

const BLUE = "#2E78F5";

function toIso(date: string, time: string): string {
  // Build a local-time ISO string with the browser's offset.
  const d = new Date(`${date}T${time}`);
  return d.toISOString();
}

export function ScheduleModal({
  contactName,
  contactEmail,
  onClose,
}: {
  contactName: string;
  contactEmail: string | null;
  onClose: () => void;
}) {
  const today = new Date();
  const defaultDate = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);
  const [title, setTitle] = useState(`Intro — ${contactName}`);
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [addMeet, setAddMeet] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const startTime = toIso(date, start);
      const endTime = new Date(new Date(startTime).getTime() + duration * 60_000).toISOString();
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: notes || null,
          startTime,
          endTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          attendees: contactEmail ? [{ email: contactEmail, name: contactName }] : [],
          addMeet,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not create the event.");
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-950">Schedule a meeting</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50"><Check className="h-5 w-5 text-emerald-600" /></span>
            <p className="text-sm font-medium text-slate-800">Meeting created</p>
            <p className="text-xs text-slate-500">{contactEmail ? `Invite sent to ${contactEmail}.` : "Added to your calendar."}</p>
          </div>
        ) : (
          <div className="space-y-3 px-5 py-4">
            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-1 block">
                <span className="text-xs font-medium text-slate-500">Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-slate-400 focus:outline-none" />
              </label>
              <label className="col-span-1 block">
                <span className="text-xs font-medium text-slate-500">Start</span>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-slate-400 focus:outline-none" />
              </label>
              <label className="col-span-1 block">
                <span className="text-xs font-medium text-slate-500">Length</span>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-slate-400 focus:outline-none">
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Notes (optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={addMeet} onChange={(e) => setAddMeet(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Add a Google Meet link
            </label>
            <p className="text-[11px] text-slate-400">
              {contactEmail ? `${contactEmail} will be invited.` : "No email on file — this contact won't receive an invite."}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} Create
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
