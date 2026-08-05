"use client";

import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { StageGuide } from "@/lib/founder/stage-guides";
import type { StageProgress, StepProgress } from "@/lib/founder/stage-progress";

function askAssistant(prompt: string) {
  window.dispatchEvent(new CustomEvent("icapos-assistant:ask", { detail: { prompt } }));
}

function pctLabel(p: StepProgress | undefined): string | null {
  if (!p || p.percent === null) return null;
  if (p.state === "not_started") return "Not started";
  return `${p.percent}%`;
}

export function StageGuideView({ guide, progress }: { guide: StageGuide; progress?: StageProgress }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-indigo,#2E78F5)]">{guide.stageLabel}</p>
      <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{guide.title}</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{guide.intro}</p>

      {progress && progress.overall !== null && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[var(--brand-indigo,#2E78F5)]" style={{ width: `${progress.overall}%` }} />
          </div>
          <span className="flex-none text-sm font-semibold text-[var(--text-primary)]">{progress.overall}% complete</span>
        </div>
      )}

      <ol className="mt-8 space-y-0">
        {guide.steps.map((step, i) => {
          const last = i === guide.steps.length - 1;
          const sp = progress?.steps[step.href];
          const done = sp?.state === "done";
          const label = pctLabel(sp);
          return (
            <li key={step.title} className="flex gap-4">
              {/* number + connector rail */}
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
                    done
                      ? "bg-emerald-500"
                      : sp?.state === "not_started" || sp?.state === "unknown"
                        ? "bg-slate-300"
                        : "bg-[var(--brand-indigo,#2E78F5)]"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                {!last && <span className="w-px flex-1 bg-[var(--border-subtle)]" />}
              </div>

              {/* card */}
              <div className={`flex-1 ${last ? "pb-0" : "pb-8"}`}>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</h3>
                    {label && (
                      <span
                        className={`flex-none text-xs font-medium ${
                          done ? "text-emerald-600" : sp?.state === "not_started" ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {label}
                      </span>
                    )}
                  </div>
                  {sp && sp.percent !== null && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-[var(--brand-indigo,#2E78F5)]"}`}
                        style={{ width: `${Math.max(sp.percent, 2)}%` }}
                      />
                    </div>
                  )}
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{step.desc}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={step.href}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      {step.hrefLabel}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    {step.ai.kind === "tool" ? (
                      <Link
                        href={step.ai.href}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-indigo,#2E78F5)]/30 bg-[var(--brand-indigo,#2E78F5)]/10 px-3 py-1.5 text-xs font-medium text-[var(--brand-indigo,#2E78F5)] hover:bg-[var(--brand-indigo,#2E78F5)]/15"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {step.ai.label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => askAssistant(step.ai.kind === "assistant" ? step.ai.prompt : "")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-indigo,#2E78F5)]/30 bg-[var(--brand-indigo,#2E78F5)]/10 px-3 py-1.5 text-xs font-medium text-[var(--brand-indigo,#2E78F5)] hover:bg-[var(--brand-indigo,#2E78F5)]/15"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {step.ai.label ?? "Ask AI"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
