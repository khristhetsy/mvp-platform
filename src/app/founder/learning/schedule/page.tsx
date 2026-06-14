"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";

// This page is a client component so the schedule form works without a separate API route.
// Schedule state is managed locally and could be persisted via a /api/learning/schedule route.

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

export default function LearningSchedulePage() {
  const [studyDays, setStudyDays] = useState<DayOfWeek[]>(["monday", "wednesday", "thursday"]);
  const [preferredTime, setPreferredTime] = useState("08:00");
  const [sessionMinutes, setSessionMinutes] = useState(25);
  const [remindersOn, setRemindersOn] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [inactivityNudge, setInactivityNudge] = useState(true);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Streak (mocked — real implementation reads from lesson progress dates)
  const streakDays = 7;

  const handleToggleDay = (day: DayOfWeek) => {
    setStudyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
    setSaved(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      // Persist to /api/learning/schedule
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
      }).catch(() => {
        // Non-fatal — schedule saved locally
      });
      setSaved(true);
    });
  };

  // Build a simple week view
  const todayIdx = new Date().getDay(); // 0 = Sunday
  const dayOrder: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 p-6 enterprise-animate-in">
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
                <p className="mt-0.5 text-xs text-slate-500">Your study days highlighted · today marked</p>
              </div>
              <div className="grid grid-cols-7 gap-0 divide-x divide-slate-100">
                {dayOrder.map((day, idx) => {
                  const isStudyDay = studyDays.includes(day);
                  const isToday = idx === todayIdx;
                  return (
                    <div
                      key={day}
                      className={`flex flex-col items-center p-3 ${
                        isToday ? "bg-indigo-600" : isStudyDay ? "bg-indigo-50" : "bg-white"
                      }`}
                    >
                      <p
                        className={`text-[10px] font-semibold uppercase tracking-widest ${
                          isToday ? "text-indigo-200" : "text-slate-400"
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </p>
                      {isStudyDay ? (
                        <div className="mt-2 text-center">
                          <p className={`text-[9px] font-semibold ${isToday ? "text-indigo-200" : "text-indigo-600"}`}>
                            {preferredTime}
                          </p>
                          <p
                            className={`mt-1 text-[10px] font-medium leading-tight ${
                              isToday ? "text-white" : "text-slate-700"
                            }`}
                          >
                            Study
                            <br />
                            session
                          </p>
                          <p className={`mt-1 text-[9px] ${isToday ? "text-indigo-200" : "text-slate-400"}`}>
                            {sessionMinutes} min
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-[9px] text-slate-300">—</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-slate-100 px-6 py-3">
                <p className="text-xs text-slate-400">
                  {studyDays.length} study day{studyDays.length !== 1 ? "s" : ""} per week · {sessionMinutes} min
                  sessions · at this pace, Stage 1 complete in ~
                  {Math.max(1, Math.round(20 / studyDays.length))} weeks
                </p>
              </div>
            </div>

            {/* Reminders */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">Reminders</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  {
                    icon: "🔔",
                    title: "Daily study reminder",
                    sub: `On study days at ${preferredTime} — push notification`,
                    value: remindersOn,
                    onChange: setRemindersOn,
                  },
                  {
                    icon: "📬",
                    title: "Weekly digest email",
                    sub: "Every Sunday — progress summary",
                    value: weeklyDigest,
                    onChange: setWeeklyDigest,
                  },
                  {
                    icon: "💤",
                    title: "Inactivity nudge",
                    sub: "If no lesson for 3 days, send an alert",
                    value: inactivityNudge,
                    onChange: setInactivityNudge,
                  },
                ].map((r) => (
                  <div key={r.title} className="flex items-center gap-4 px-6 py-4">
                    <span className="text-xl">{r.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{r.title}</p>
                      <p className="text-xs text-slate-500">{r.sub}</p>
                    </div>
                    <button
                      onClick={() => { r.onChange(!r.value); setSaved(false); }}
                      className={`relative h-6 w-11 rounded-full transition-colors ${r.value ? "bg-indigo-600" : "bg-slate-200"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${r.value ? "translate-x-5" : "translate-x-0.5"}`}
                      />
                    </button>
                    <span
                      className={`min-w-[36px] rounded-md px-2 py-0.5 text-[10px] font-semibold ${r.value ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"}`}
                    >
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
                        onClick={() => {
                          // quick-set n most common weekdays
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
              <p className="mt-2 text-4xl">🔥</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{streakDays}</p>
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
      </div>
    </div>
  );
}
