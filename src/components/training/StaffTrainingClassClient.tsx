"use client";

import { useState } from "react";
import type { TrainingModule } from "@/lib/learning/staff-training/catalog";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { error?: string; reply?: string; feedback?: string | null };
  if (!r.ok) throw new Error(j.error ?? "Request failed.");
  return j;
}

export function StaffTrainingClassClient({ mod, doneSteps, coachOn, reviewer }: { mod: TrainingModule; doneSteps: number[]; coachOn: boolean; reviewer: string }) {
  const steps = mod.steps ?? [];
  const [done, setDone] = useState<Set<number>>(new Set(doneSteps));
  const [step, setStep] = useState(() => Math.min(steps.length - 1, Math.max(0, steps.findIndex((_, i) => !doneSteps.includes(i)))));
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [ans, setAns] = useState<Record<number, string>>({});
  const [fb, setFb] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = steps[step];

  async function guard(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); } finally { setBusy(false); }
  }
  const markDone = () => guard(async () => {
    await post("/api/training/staff/progress", { moduleKey: mod.key, stepIndex: step });
    setDone((d) => new Set(d).add(step));
    if (step < steps.length - 1) { setStep(step + 1); setReply(null); }
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {steps.map((st, i) => (
          <button type="button" key={st.title} onClick={() => { setStep(i); setReply(null); }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${i === step ? "border-[#1A6CE4] bg-[#1A6CE4] text-white" : "border-slate-200 bg-white text-slate-700"}`}>
            {done.has(i) ? "✓ " : ""}Step {i + 1}
          </button>
        ))}
      </div>
      {s ? (
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-[#0A1A40]">Step {step + 1}. {s.title}</h2>
          <p className="mt-2 text-sm text-slate-700">{s.intro}</p>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.doTitle}</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-800">{s.doList.map((x) => <li key={x}>{x}</li>)}</ol>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.noteTitle}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">{s.notes.map((x) => <li key={x}>{x}</li>)}</ul>
          <div className="mt-5 flex justify-end">
            <button type="button" disabled={busy} onClick={markDone} className="rounded-lg bg-[#1A6CE4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2E78F5] disabled:opacity-50">
              {done.has(step) ? "Done, next step" : "Mark step done"}
            </button>
          </div>
        </article>
      ) : null}

      {coachOn ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Ask the coach</h2>
          <div className="mt-2 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this lesson" className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <button type="button" disabled={busy || !q.trim()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              onClick={() => guard(async () => { const j = await post("/api/training/staff/coach", { moduleKey: mod.key, question: q }); setReply(j.reply ?? null); })}>Ask</button>
          </div>
          {reply ? <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{reply}</p> : null}
          <p className="mt-2 text-xs text-slate-500">The coach answers from this lesson only and can be wrong. Check with {reviewer} when unsure.</p>
        </section>
      ) : null}

      {(mod.exercises ?? []).length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Exercises</h2>
          <p className="text-xs text-slate-500">{coachOn ? "The coach gives a first pass. " : ""}{reviewer} decides Pass or Redo.</p>
          {(mod.exercises ?? []).map((ex, i) => (
            <div key={ex.title} className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-sm font-medium text-slate-900">{i + 1}. {ex.title}</p>
              <p className="text-sm text-slate-600">{ex.prompt}</p>
              <textarea value={ans[i] ?? ""} onChange={(e) => setAns({ ...ans, [i]: e.target.value })} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <div className="mt-1 flex justify-end">
                <button type="button" disabled={busy || !(ans[i] ?? "").trim()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  onClick={() => guard(async () => { const j = await post("/api/training/staff/exercise", { moduleKey: mod.key, exerciseIndex: i, answer: ans[i] }); setFb({ ...fb, [i]: j.feedback ?? "Submitted. Your reviewer will respond." }); })}>Submit</button>
              </div>
              {fb[i] ? <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{fb[i]}</p> : null}
            </div>
          ))}
        </section>
      ) : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
