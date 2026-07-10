"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, Check, Plus, Trash2 } from "lucide-react";
import type { AvailabilitySettings, WeeklyRule, ScheduleQuestion } from "@/lib/scheduling/types";

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
  const t = useTranslations("sharedCmp");
  const [days, setDays] = useState<DayState[]>(() => rulesToDays([]));
  const [timezone, setTimezone] = useState(LOCAL_TZ);
  const [slotDurations, setSlotDurations] = useState<number[]>([30, 60]);
  const [bufferMinutes, setBufferMinutes] = useState(0);

  const toggleDuration = (n: number) =>
    setSlotDurations((prev) => (prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n].sort((a, b) => a - b)));
  const [meetingTitle, setMeetingTitle] = useState("");
  const [questions, setQuestions] = useState<ScheduleQuestion[]>([]);

  const addQuestion = () =>
    setQuestions((p) => [...p, { id: (crypto.randomUUID?.() ?? String(Date.now())), label: "", type: "multi", options: ["Option 1"], required: false }]);
  const updateQuestion = (id: string, patch: Partial<ScheduleQuestion>) =>
    setQuestions((p) => p.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const removeQuestion = (id: string) => setQuestions((p) => p.filter((q) => q.id !== id));
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
        setSlotDurations(
          Array.isArray(s.slotDurations) && s.slotDurations.length > 0
            ? [...s.slotDurations].sort((a, b) => a - b)
            : [s.slotMinutes ?? 30],
        );
        setBufferMinutes(s.bufferMinutes ?? 0);
        setMeetingTitle(s.meetingTitle ?? "");
        setQuestions(Array.isArray(s.questions) ? s.questions : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async () => {
    if (slotDurations.length === 0) {
      setMsg("Pick at least one meeting length.");
      return;
    }
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
        body: JSON.stringify({
          timezone, slotDurations, bufferMinutes, weeklyRules, meetingTitle,
          questions: questions.filter((q) => q.label.trim()).map((q) => ({ ...q, options: q.type === "short_text" ? [] : q.options.filter((o) => o.trim()) })),
        }),
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
  }, [days, timezone, slotDurations, bufferMinutes, meetingTitle, questions]);

  const setDay = (i: number, patch: Partial<DayState>) =>
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  if (loading) return <p className="text-sm text-slate-500">{t("loading_availability")}</p>;

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
          <span className="font-medium">{t("your_booking_link")}</span>
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
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">{t("meeting_name")}</span>
          <input
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder={`Meeting with you (e.g. "ICFO intro call")`}
            className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
          <span className="mt-1 block text-[11px] text-slate-400">{t("shown_on_your_booking_page_leave_blank_to_us")}</span>
        </label>
        <div className="mb-4 flex flex-wrap gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">{t("timezone")}</span>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Meeting lengths you offer</span>
            <div className="flex flex-wrap gap-1.5">
              {[15, 30, 45, 60].map((n) => {
                const on = slotDurations.includes(n);
                return (
                  <label key={n}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${on ? "border-[#85B7EB] bg-[#E6F1FB] text-[#0C447C]" : "border-slate-200 text-slate-600"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleDuration(n)} className="h-3.5 w-3.5 rounded" />
                    {n} min
                  </label>
                );
              })}
            </div>
            <span className="mt-1 block text-[11px] text-slate-400">Bookers pick one of these when they book.</span>
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">{t("buffer_between")}</span>
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
                <span className="text-sm text-slate-400">{t("unavailable")}</span>
              )}
            </div>
          ))}
        </div>

        {/* Booking questions */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{t("booking_questions")}</p>
              <p className="text-xs text-slate-500">{t("asked_on_your_booking_page_answers_arrive_wi")}</p>
            </div>
            <button type="button" onClick={addQuestion} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /> Add question</button>
          </div>
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input value={q.label} onChange={(e) => updateQuestion(q.id, { label: e.target.value })} placeholder={t("question_label")} className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
                  <select value={q.type} onChange={(e) => updateQuestion(q.id, { type: e.target.value as ScheduleQuestion["type"] })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                    <option value="short_text">Short text</option>
                    <option value="single">Single choice</option>
                    <option value="multi">Checkboxes</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} className="h-3.5 w-3.5" /> Required</label>
                  <button type="button" onClick={() => removeQuestion(q.id)} className="rounded p-1 text-slate-400 hover:text-[#A32D2D]" aria-label="Remove question"><Trash2 className="h-4 w-4" /></button>
                </div>
                {q.type !== "short_text" ? (
                  <div className="mt-2 space-y-1.5 pl-1">
                    {q.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={opt} onChange={(e) => updateQuestion(q.id, { options: q.options.map((o, j) => (j === i ? e.target.value : o)) })} placeholder={`Option ${i + 1}`} className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-1 text-sm" />
                        <button type="button" onClick={() => updateQuestion(q.id, { options: q.options.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-[#A32D2D]"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => updateQuestion(q.id, { options: [...q.options, `Option ${q.options.length + 1}`] })} className="text-xs font-medium text-[#185FA5] hover:underline">+ Add option</button>
                  </div>
                ) : null}
              </div>
            ))}
            {questions.length === 0 ? <p className="text-xs text-slate-400">{t("no_questions_yet_add_one_to_collect_info_fro")}</p> : null}
          </div>
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
