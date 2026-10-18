"use client";

import { useEffect, useState } from "react";
import type { CoachStep } from "@/lib/learning/course-types";
import type { CoachSnapshot } from "@/lib/learning/coach/data-reads";
import { COACH_TONES, type CoachTone, TONE_LABELS } from "@/lib/learning/coach/tones";

type CoachState = {
  active: boolean;
  tone: CoachTone;
  steps: CoachStep[];
  doneIndexes: number[];
  /** Approved screenshots by step index. Missing entries simply show no image. */
  screenshots?: Record<number, { url: string; capturedAt: string | null; pinned: boolean }>;
};

type DueChoice = "today" | "tomorrow" | "this_week";
const DUE_LABELS: Record<DueChoice, string> = { today: "Today", tomorrow: "Tomorrow", this_week: "This week" };

/**
 * The AI IR Coach step card, shown inside the existing floating coach. It renders nothing unless
 * the coach is active for this founder and course, so every other lesson looks exactly as before.
 * Check ins save to the founder's own rows. Nothing goes to Tasks or Calendar from here.
 */
export function CoachStepCard({ courseSlug, lessonSlug }: Readonly<{ courseSlug: string; lessonSlug: string }>) {
  const [state, setState] = useState<CoachState | null>(null);
  const [index, setIndex] = useState(0);
  const [reply, setReply] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choosingTime, setChoosingTime] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reads, setReads] = useState<CoachSnapshot | null>(null);
  const [readsOpen, setReadsOpen] = useState(false);
  const [readsFailed, setReadsFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ courseSlug, lessonSlug });
    fetch(`/api/founder/learning/coach/state?${q}`)
      .then((res) => (res.ok ? (res.json() as Promise<CoachState>) : null))
      .then((body) => {
        if (cancelled || !body) return;
        setState(body);
        const firstOpen = body.steps.findIndex((_, i) => !body.doneIndexes.includes(i));
        setIndex(firstOpen === -1 ? Math.max(0, body.steps.length - 1) : firstOpen);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [courseSlug, lessonSlug]);

  async function checkIn(event: "done" | "stuck" | "skipped", dueChoice?: DueChoice) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/founder/learning/coach/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug, lessonSlug, stepIndex: index, event, dueChoice }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setError(body.error ?? "Could not save. Try again.");
      return;
    }
    const body = (await res.json()) as { reply: string; nextStepIndex: number };
    setReply(body.reply);
    setSaved(true);
    setChoosingTime(false);
    if (event === "done") {
      setState((s) => (s ? { ...s, doneIndexes: [...new Set([...s.doneIndexes, index])] } : s));
      setIndex(body.nextStepIndex);
    }
  }

  async function toggleReads() {
    const next = !readsOpen;
    setReadsOpen(next);
    if (!next || reads) return;
    setReadsFailed(false);
    const res = await fetch(`/api/founder/learning/coach/snapshot?${new URLSearchParams({ courseSlug })}`).catch(() => null);
    if (!res?.ok) {
      setReadsFailed(true);
      return;
    }
    setReads((await res.json()) as CoachSnapshot);
  }

  async function setTone(tone: CoachTone) {
    setState((s) => (s ? { ...s, tone } : s));
    await fetch("/api/founder/learning/coach/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_tone", tone }),
    }).catch(() => null);
  }

  async function pause() {
    await fetch("/api/founder/learning/coach/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    }).catch(() => null);
    setState((s) => (s ? { ...s, active: false } : s));
  }

  if (!state?.active || state.steps.length === 0) return null;
  const step = state.steps[index];
  const allDone = state.doneIndexes.length >= state.steps.length;

  return (
    <div className="rounded-xl bg-indigo-50 px-3.5 py-3 ring-1 ring-indigo-100" aria-label="AI IR Coach step">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
          {allDone ? "All steps done" : `Step ${index + 1} of ${state.steps.length}`}
        </p>
        <div className="flex items-center gap-1.5">
          {saved ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Saved
            </span>
          ) : null}
          <select
            aria-label="Coaching style"
            value={state.tone}
            onChange={(e) => void setTone(e.target.value as CoachTone)}
            className="rounded-md border border-indigo-100 bg-white px-1.5 py-0.5 text-[10px] text-slate-700"
          >
            {COACH_TONES.map((t) => (
              <option key={t} value={t}>
                {TONE_LABELS[t].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!allDone ? (
        <>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">{step.title}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-700">{step.instruction}</p>
          <p className="mt-1.5 text-[11px] text-slate-600">
            <span className="font-semibold">Menu path:</span> {step.menuPath.join(" › ")}
          </p>
          {step.commonMistake ? (
            <p className="mt-1 text-[11px] text-slate-600">
              <span className="font-semibold">Common mistake:</span> {step.commonMistake}
            </p>
          ) : null}
          {state.screenshots?.[index] ? (
            <figure className="mt-2">
              {/* Signed link to a private bucket, so next/image optimisation does not apply. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.screenshots[index].url}
                alt={`Screenshot of ${step.title}${state.screenshots[index].pinned ? ". The numbered pin marks the control to use." : ""}`}
                className="w-full rounded-lg ring-1 ring-indigo-100"
                loading="lazy"
              />
              <figcaption className="mt-0.5 text-[10px] text-slate-500">
                Demo account, no real data{state.screenshots[index].capturedAt ? `. Captured ${new Date(state.screenshots[index].capturedAt as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.` : "."}
              </figcaption>
            </figure>
          ) : null}
          {step.example ? (
            <p className="mt-1 text-[11px] text-slate-600">
              <span className="font-semibold">Example:</span> {step.example}
            </p>
          ) : null}

          {choosingTime ? (
            <div className="mt-2.5">
              <p className="text-[11px] font-medium text-slate-700">When will you do it? Times are Pacific.</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(Object.keys(DUE_LABELS) as DueChoice[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={busy}
                    onClick={() => void checkIn("skipped", c)}
                    className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {DUE_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void checkIn("done")}
                className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                I did it
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void checkIn("stuck")}
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                I am stuck
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setChoosingTime(true)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Not now
              </button>
            </div>
          )}
        </>
      ) : null}

      {reply ? (
        <p className="mt-2.5 whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-800 ring-1 ring-indigo-100">
          {reply}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[11px] text-red-600">{error}</p> : null}

      <button
        type="button"
        aria-expanded={readsOpen}
        onClick={() => void toggleReads()}
        className="mt-2 mr-3 text-[10px] text-slate-500 underline hover:text-slate-700"
      >
        What I read
      </button>
      {readsOpen ? (
        <div className="mt-1.5 space-y-1.5 rounded-lg bg-white px-3 py-2 ring-1 ring-indigo-100">
          <p className="text-[10px] text-slate-500">Only your own company&apos;s data in iCapOS. When a source is empty I say so and coach from the course.</p>
          {readsFailed ? <p className="text-[11px] text-red-600">Could not load this right now.</p> : null}
          {!reads && !readsFailed ? <p className="text-[11px] text-slate-500">Loading…</p> : null}
          {reads?.sources.map((src) => (
            <div key={src.key}>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                {src.label}
                {src.status !== "data" ? (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500">
                    {src.status === "empty" ? "Empty" : "Not available"}
                  </span>
                ) : null}
              </p>
              {src.status === "unavailable" ? (
                <p className="text-[11px] text-slate-600">Could not be read right now.</p>
              ) : (
                src.facts.map((f) => (
                  <p key={f} className="text-[11px] text-slate-600">
                    {f}
                  </p>
                ))
              )}
              <p className="text-[10px] text-slate-400">{src.provenance}</p>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void pause()}
        className="mt-2 text-[10px] text-slate-500 underline hover:text-slate-700"
      >
        Pause my coach
      </button>
    </div>
  );
}
