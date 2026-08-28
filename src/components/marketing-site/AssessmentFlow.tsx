"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ASSESSMENT_QUESTIONS } from "@/lib/assessment/questions";
import { assessment } from "@/content/assessment";

type Band = "foundation" | "emerging" | "ready";
type Result = {
  leadPrescore: number;
  band: Band;
  headline: string;
  routing: { plan: string; href: string; ctaLabel: string; viaLearning: boolean };
};

const BAND_LABEL: Record<Band, string> = { foundation: "Foundation", emerging: "Emerging", ready: "Ready" };
const BAND_COLOR: Record<Band, string> = { foundation: "#BA7517", emerging: "#2E78F5", ready: "#0F6E56" };

function newSessionId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export function AssessmentFlow() {
  const questions = ASSESSMENT_QUESTIONS;
  const [sessionId] = useState(newSessionId);
  const [step, setStep] = useState(0); // 0..N-1 questions, N = email, N+1 = result
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const emailStep = questions.length;
  const total = questions.length;
  const progress = result ? 100 : Math.round((Math.min(step, total) / (total + 1)) * 100);

  const utm = useMemo(() => {
    if (typeof window === "undefined") return {};
    const p = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = p.get(k);
      if (v) out[k] = v;
    }
    return out;
  }, []);

  function choose(qid: string, oid: string) {
    setAnswers((a) => ({ ...a, [qid]: oid }));
    setStep((s) => s + 1);
  }

  async function submit() {
    if (!/.+@.+\..+/.test(email)) {
      setError("Enter a valid work email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: fullName || null, companyName: company || null, answers, utm, sessionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not process the assessment.");
      setResult(json as Result);
      setStep(emailStep + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setAnswers({});
    setEmail("");
    setFullName("");
    setCompany("");
    setResult(null);
    setError(null);
    setStep(0);
  }

  const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
  const q = step < total ? questions[step] : null;

  return (
    <div className="mx-auto max-w-xl">
      {/* Progress */}
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-site-blue transition-all" style={{ width: `${progress}%`, backgroundColor: "#2E78F5" }} />
      </div>

      {q ? (
        <div className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Question {step + 1} of {total}</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{q.prompt}</h2>
          <div className="mt-4 space-y-2">
            {q.options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => choose(q.id, o.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                  answers[q.id] === o.id ? "border-indigo-600 bg-indigo-50/60" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="text-slate-800">{o.label}</span>
                <i className="ti ti-chevron-right text-slate-300" aria-hidden="true" />
              </button>
            ))}
          </div>
          {step > 0 ? (
            <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className="mt-4 text-xs font-medium text-slate-400 hover:text-slate-600">
              ← Back
            </button>
          ) : null}
        </div>
      ) : step === emailStep ? (
        <div className={card}>
          <h2 className="text-xl font-semibold text-slate-900">{assessment.emailStep.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{assessment.emailStep.sub}</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-slate-500">{assessment.emailStep.emailLabel}</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={assessment.emailStep.emailPlaceholder} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">{assessment.emailStep.nameLabel}</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500">{assessment.emailStep.companyLabel}</label>
                <input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          <button type="button" onClick={submit} disabled={busy} className="mt-5 w-full rounded-lg bg-site-blue px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "#2E78F5" }}>
            {busy ? "Scoring…" : assessment.emailStep.submit}
          </button>
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className="mt-3 text-xs font-medium text-slate-400 hover:text-slate-600">← Back</button>
          <p className="mt-4 text-[11px] leading-5 text-slate-400">{assessment.emailStep.disclaimer}</p>
        </div>
      ) : result ? (
        <div className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{assessment.result.scoreLabel}</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-semibold" style={{ border: `5px solid ${BAND_COLOR[result.band]}`, color: BAND_COLOR[result.band] }}>
              {result.leadPrescore}
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: BAND_COLOR[result.band] }}>{BAND_LABEL[result.band]}</div>
              <p className="mt-1 text-sm text-slate-600">{result.headline}</p>
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-500">{assessment.result.bandNote}</p>
          {result.routing.viaLearning ? <p className="mt-3 text-sm text-slate-500">{assessment.result.learningNote}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={result.routing.href} className="rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{ backgroundColor: "#2E78F5" }}>{result.routing.ctaLabel}</Link>
            <Link href={assessment.result.ctaFallbackHref} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{assessment.result.ctaFallback}</Link>
          </div>
          <button type="button" onClick={restart} className="mt-4 text-xs font-medium text-slate-400 hover:text-slate-600">{assessment.result.restart}</button>
        </div>
      ) : null}
    </div>
  );
}
