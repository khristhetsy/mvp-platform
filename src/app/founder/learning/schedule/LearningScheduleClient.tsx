"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";

const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type DayOfWeek = (typeof DAYS_OF_WEEK)[number];
const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};
const DAY_FULL: Record<DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------
function IcoBell() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A8 8 0 0 0 2 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

function IcoMail() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  );
}

function IcoClock() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function IcoFlame() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
    </svg>
  );
}

function IcoBook() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Drawer primitives (same pattern as other drawers)
// ---------------------------------------------------------------------------
function DStatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100 text-center">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function AdviceBox({ lines }: { lines: string[] }) {
  return (
    <div className="mt-4 rounded-xl p-4" style={{ background: "#1e1b4b" }}>
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: "#534AB7" }}
        >
          AI
        </div>
        <span className="text-sm font-medium" style={{ color: "#e0e7ff" }}>
          Founder Intelligence
        </span>
      </div>
      <div className="space-y-2.5">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 text-xs leading-relaxed">
            <span className="shrink-0 font-semibold" style={{ color: "#818cf8" }}>{i + 1}.</span>
            <span style={{ color: "#c7d2fe" }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day session drawer content
// ---------------------------------------------------------------------------
function DayDrawerContent({
  day,
  preferredTime,
  sessionMinutes,
  studyDaysPerWeek,
  onClose,
}: {
  day: DayOfWeek;
  preferredTime: string;
  sessionMinutes: number;
  studyDaysPerWeek: number;
  onClose: () => void;
}) {
  const weeklyMinutes = studyDaysPerWeek * sessionMinutes;
  const weeksToStage1 = Math.max(1, Math.round(20 / studyDaysPerWeek));

  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">{DAY_FULL[day]} — Study Session</p>
          <p className="mt-0.5 text-xs text-slate-500">Scheduled learning block for this day</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DStatBox label="Start time" value={preferredTime} />
        <DStatBox label="Duration" value={`${sessionMinutes}m`} />
        <DStatBox label="Days/week" value={String(studyDaysPerWeek)} />
      </div>

      <p className="mt-5 text-xs font-semibold text-slate-900">Session details</p>
      <div className="mt-2 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Session time</span>
          <span className="font-semibold text-slate-900">{preferredTime} on {DAY_FULL[day]}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Session length</span>
          <span className="font-semibold text-slate-900">{sessionMinutes} minutes</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Weekly learning time</span>
          <span className="font-semibold text-slate-900">{weeklyMinutes} min / week</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Stage 1 completion</span>
          <span className="font-semibold text-indigo-700">~{weeksToStage1} week{weeksToStage1 !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">What this means</p>
        <p className="text-xs leading-relaxed text-slate-600">
          Your {DAY_FULL[day]} session is a {sessionMinutes}-minute focused block starting at {preferredTime}.
          At {studyDaysPerWeek} sessions per week you accumulate {weeklyMinutes} minutes of learning weekly —
          enough to complete Stage 1 in approximately {weeksToStage1} week{weeksToStage1 !== 1 ? "s" : ""}.
          Consistency on scheduled days is the strongest predictor of course completion.
        </p>
      </div>

      <AdviceBox
        lines={[
          `Protect your ${preferredTime} ${DAY_FULL[day]} block. Research shows that learning scheduled at a consistent time is 2× more likely to happen than ad-hoc sessions — treat it like a meeting you can't cancel.`,
          sessionMinutes === 15
            ? "15-minute sessions are great for busy days. If you find yourself with more time, extend naturally — the key is to show up consistently rather than waiting for a long block."
            : sessionMinutes === 25
            ? `25-minute Pomodoro sessions are optimal for deep learning. After each session, take a 5-minute break before your next task — this consolidates memory formation.`
            : `30-minute sessions allow for meaningful depth on complex topics like cap table structures or term sheet negotiation. Use the first 5 minutes to review your previous session's key takeaway.`,
          `Your ${studyDaysPerWeek}-day schedule gives you ${weeklyMinutes} minutes of learning per week. At this pace you'll have the knowledge foundation investors expect from a well-prepared founder within ${weeksToStage1} week${weeksToStage1 !== 1 ? "s" : ""}.`,
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function LearningScheduleClient() {
  const [studyDays, setStudyDays] = useState<DayOfWeek[]>(["monday", "wednesday", "thursday"]);
  const [preferredTime, setPreferredTime] = useState("08:00");
  const [sessionMinutes, setSessionMinutes] = useState(25);
  const [remindersOn, setRemindersOn] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [inactivityNudge, setInactivityNudge] = useState(true);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [openDay, setOpenDay] = useState<DayOfWeek | null>(null);

  const streakDays = 7;

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = openDay ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [openDay]);

  const handleToggleDay = (day: DayOfWeek) => {
    setStudyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
    setSaved(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      await fetch("/api/learning/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyDays,
          preferredTime,
          sessionMinutes,
          remindersOn,
          weeklyDigest,
          inactivityNudge,
        }),
      }).catch(() => {});
      setSaved(true);
    });
  };

  const todayIdx = new Date().getDay();
  const dayOrder: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  const reminders = [
    {
      icon: <IcoBell />,
      iconBg: "bg-indigo-50 text-indigo-600",
      title: "Daily study reminder",
      sub: `On study days at ${preferredTime} — push notification`,
      value: remindersOn,
      onChange: setRemindersOn,
    },
    {
      icon: <IcoMail />,
      iconBg: "bg-sky-50 text-sky-600",
      title: "Weekly digest email",
      sub: "Every Sunday — progress summary",
      value: weeklyDigest,
      onChange: setWeeklyDigest,
    },
    {
      icon: <IcoClock />,
      iconBg: "bg-amber-50 text-amber-600",
      title: "Inactivity nudge",
      sub: "If no lesson for 3 days, send an alert",
      value: inactivityNudge,
      onChange: setInactivityNudge,
    },
  ];

  return (
    <div className="space-y-6 enterprise-animate-in">
      <div className="flex items-center gap-4">
        <Link
          href="/founder/learning"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          ← Overview
        </Link>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600">Learning</p>
          <h1 className="text-2xl font-semibold text-slate-900">My schedule</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly calendar */}
        <div className="space-y-4 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">This week</h2>
              <p className="mt-0.5 text-xs text-slate-500">Click a study session to view details</p>
            </div>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 gap-0 divide-x divide-slate-100 min-w-[420px]">
                {dayOrder.map((day, idx) => {
                  const isStudyDay = studyDays.includes(day);
                  const isToday = idx === todayIdx;
                  return isStudyDay ? (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setOpenDay(day)}
                      className={`flex flex-col items-center p-3 w-full transition ${
                        isToday
                          ? "bg-indigo-600 hover:bg-indigo-700"
                          : "bg-indigo-50 hover:bg-indigo-100"
                      }`}
                    >
                      <p className={`text-[10px] font-semibold uppercase tracking-widest ${isToday ? "text-indigo-200" : "text-slate-400"}`}>
                        {DAY_LABELS[day]}
                      </p>
                      <div className="mt-2 text-center">
                        <p className={`text-[9px] font-semibold ${isToday ? "text-indigo-200" : "text-indigo-600"}`}>
                          {preferredTime}
                        </p>
                        <p className={`mt-1 text-[10px] font-medium leading-tight ${isToday ? "text-white" : "text-slate-700"}`}>
                          Study
                          <br />
                          session
                        </p>
                        <p className={`mt-1 text-[9px] ${isToday ? "text-indigo-200" : "text-slate-400"}`}>
                          {sessionMinutes} min
                        </p>
                      </div>
                      <div className={`mt-2 flex h-4 w-4 items-center justify-center rounded-full ${isToday ? "bg-white/20" : "bg-indigo-100"}`}>
                        <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 ${isToday ? "text-white" : "text-indigo-500"}`} fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l4 3-4 3" />
                        </svg>
                      </div>
                    </button>
                  ) : (
                    <div
                      key={day}
                      className={`flex flex-col items-center p-3 ${isToday ? "bg-indigo-600" : "bg-white"}`}
                    >
                      <p className={`text-[10px] font-semibold uppercase tracking-widest ${isToday ? "text-indigo-200" : "text-slate-400"}`}>
                        {DAY_LABELS[day]}
                      </p>
                      <p className="mt-3 text-[9px] text-slate-300">—</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-slate-100 px-6 py-3">
              <p className="text-xs text-slate-400">
                {studyDays.length} study day{studyDays.length !== 1 ? "s" : ""} per week · {sessionMinutes} min
                sessions · at this pace, Stage 1 complete in ~{Math.max(1, Math.round(20 / studyDays.length))} weeks
              </p>
            </div>
          </div>

          {/* Reminders */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Reminders</h2>
              <p className="mt-0.5 text-xs text-slate-500">Toggle notifications for your learning schedule</p>
            </div>
            <div className="divide-y divide-slate-100">
              {reminders.map((r) => (
                <div key={r.title} className="flex items-center gap-4 px-6 py-4">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${r.iconBg}`}>
                    {r.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-500">{r.sub}</p>
                  </div>
                  {/* Toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.value}
                    onClick={() => { r.onChange(!r.value); setSaved(false); }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      r.value ? "bg-indigo-600" : "bg-slate-200"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        r.value ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className={`min-w-[28px] text-xs font-semibold ${r.value ? "text-indigo-600" : "text-slate-400"}`}>
                    {r.value ? "On" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: settings + streak */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Schedule settings</h2>
            </div>
            <div className="divide-y divide-slate-100 px-5">
              <div className="flex items-center py-3">
                <span className="flex-1 text-sm text-slate-700">Study days per week</span>
                <div className="flex gap-1">
                  {([3, 4, 5] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        const defaults: Record<number, DayOfWeek[]> = {
                          3: ["monday", "wednesday", "friday"],
                          4: ["monday", "tuesday", "thursday", "friday"],
                          5: ["monday", "tuesday", "wednesday", "thursday", "friday"],
                        };
                        setStudyDays(defaults[n]);
                        setSaved(false);
                      }}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        studyDays.length === n ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center py-3">
                <span className="flex-1 text-sm text-slate-700">Preferred time</span>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => { setPreferredTime(e.target.value); setSaved(false); }}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                />
              </div>

              <div className="flex items-center py-3">
                <span className="flex-1 text-sm text-slate-700">Session length</span>
                <div className="flex gap-1">
                  {([15, 25, 30] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setSessionMinutes(m); setSaved(false); }}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        sessionMinutes === m ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="py-3">
                <p className="mb-2 text-sm text-slate-700">Study days</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleToggleDay(day)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        studyDays.includes(day)
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {isPending ? "Saving…" : saved ? "✓ Saved" : "Update schedule"}
              </button>
            </div>
          </div>

          {/* Streak */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Study streak</p>
            <div className="mx-auto mt-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <IcoFlame />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{streakDays}</p>
            <p className="text-xs text-slate-500">day streak</p>
            <p className="mt-1 text-xs font-semibold text-green-700">Personal best!</p>
            <div className="mt-3 flex justify-center gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded ${i < streakDays ? "bg-indigo-600" : "bg-slate-100"}`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">Mon → Sun this week</p>
          </div>
        </div>
      </div>

      {/* Day detail drawer — centered 448×536 */}
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        style={{
          opacity: openDay ? 1 : 0,
          pointerEvents: openDay ? "auto" : "none",
          transition: "opacity 200ms",
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "rgba(12, 35, 64, 0.35)" }}
          onClick={() => setOpenDay(null)}
        />
        <div
          className="relative w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
          style={{
            maxWidth: 448,
            maxHeight: 536,
            transform: openDay ? "translateY(0)" : "translateY(40px)",
            transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {openDay && (
            <DayDrawerContent
              day={openDay}
              preferredTime={preferredTime}
              sessionMinutes={sessionMinutes}
              studyDaysPerWeek={studyDays.length}
              onClose={() => setOpenDay(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
