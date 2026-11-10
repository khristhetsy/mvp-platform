"use client";

import Link from "next/link";
import { ArrowRight, Check, Lock, Sparkles } from "lucide-react";
import type { InvestorGuideView } from "@/lib/investor/stage-guides";

function askAssistant(prompt: string) {
  window.dispatchEvent(new CustomEvent("icapos-assistant:ask", { detail: { prompt } }));
}

const CHIP = {
  complete: { cls: "bg-emerald-50 text-emerald-700", label: "Complete" },
  current: { cls: "bg-amber-50 text-amber-700", label: "In progress" },
  locked: { cls: "bg-slate-100 text-slate-500", label: "Locked" },
} as const;

export function InvestorStageGuideView({ guide }: { guide: InvestorGuideView }) {
  const chip = CHIP[guide.stageStatus];
  const locked = guide.stageStatus === "locked";
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-indigo,#2E78F5)]">{guide.stageLabel}</p>
      <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{guide.title}</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{guide.intro}</p>

      {guide.gate && (
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">To unlock {guide.gate.nextLabel}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chip.cls}`}>{chip.label}</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {guide.gate.items.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm text-slate-700">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full ${item.met ? "bg-emerald-500 text-white" : "bg-slate-200"}`}
                  aria-hidden
                >
                  {item.met ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {guide.percent !== null && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Stage progress</span>
            <span>{guide.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${guide.percent}%` }} />
          </div>
        </div>
      )}

      {locked && (
        <p className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-slate-50 px-4 py-3 text-sm text-[var(--text-muted)]">
          This stage opens once you clear the stage before it. You can read ahead here.
        </p>
      )}

      <ol className="mt-8 space-y-0">
        {guide.steps.map((step, i) => {
          const last = i === guide.steps.length - 1;
          const done = step.state === "done";
          const isLocked = step.state === "locked";
          return (
            <li key={step.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
                    done ? "bg-emerald-500" : step.state === "current" ? "bg-[var(--brand-indigo,#2E78F5)]" : "bg-slate-300"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : isLocked ? <Lock className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {!last && <span className="w-px flex-1 bg-[var(--border-subtle)]" />}
              </div>
              <div className="mb-4 flex-1 rounded-xl border border-[var(--border-subtle)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{step.title}</h3>
                    <p className={`mt-0.5 text-sm ${done && step.detail ? "text-emerald-700" : "text-[var(--text-muted)]"}`}>
                      {done && step.detail ? step.detail : step.desc}
                    </p>
                  </div>
                  {isLocked ? (
                    <span className="shrink-0 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-slate-400">
                      Locked
                    </span>
                  ) : (
                    <Link
                      href={step.href}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        step.state === "current"
                          ? "bg-[var(--brand-indigo,#2E78F5)] text-white hover:opacity-90"
                          : "border border-[var(--border-subtle)] bg-white text-[var(--text-secondary)] hover:bg-slate-50"
                      }`}
                    >
                      {step.state === "current" ? <ArrowRight className="h-3.5 w-3.5" /> : null}
                      {done ? "Open" : step.hrefLabel}
                    </Link>
                  )}
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => askAssistant(step.prompt)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-indigo,#2E78F5)] hover:underline"
                  >
                    <Sparkles className="h-3 w-3" />
                    Ask the assistant
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
