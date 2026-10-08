"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, Check, CheckCircle2, CircleDashed, Pencil, Sparkles } from "lucide-react";
import type { StageGuide, StageGuideStep } from "@/lib/founder/stage-guides";
import type { StageProgress, StepProgress } from "@/lib/founder/stage-progress";
import type { StageGate } from "@/lib/founder/stage-gate-status";
import { StageGatePanel } from "@/components/founder/StageGatePanel";

function askAssistant(prompt: string) {
  window.dispatchEvent(new CustomEvent("icapos-assistant:ask", { detail: { prompt } }));
}

/** Steps with no measurable signal count as done once opened from the guide. */
function recordVisit(step: StageGuideStep) {
  if (!step.doneOnVisit) return;
  try {
    void fetch("/api/founder/stage-steps/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ href: step.href }),
      keepalive: true,
    });
  } catch {
    /* best effort */
  }
}

// Every date in iCapOS is Pacific time.
const PT_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function completedLabel(sp: StepProgress | undefined): string {
  if (!sp?.completedAt) return "Completed";
  const d = new Date(sp.completedAt);
  return Number.isNaN(d.getTime()) ? "Completed" : `Completed ${PT_DATE.format(d)}`;
}

function pctLabel(p: StepProgress | undefined): string | null {
  if (!p) return null;
  if (p.badge) return p.badge;
  if (p.percent === null) return null;
  if (p.state === "not_started") return "Not started";
  return `${p.percent}%`;
}

const AI_BTN =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-indigo,#2E78F5)]/30 bg-[var(--brand-indigo,#2E78F5)]/10 px-3 py-1.5 text-xs font-medium text-[var(--brand-indigo,#2E78F5)] hover:bg-[var(--brand-indigo,#2E78F5)]/15";

export function StageGuideView({
  guide,
  progress,
  gate,
  stageNumber,
  nextStageSlug,
  showManualOutreachBanner,
}: {
  guide: StageGuide;
  progress?: StageProgress;
  gate?: StageGate;
  stageNumber?: number;
  nextStageSlug?: string | null;
  showManualOutreachBanner?: boolean;
}) {
  const stateOf = (s: StageGuideStep) => progress?.steps[s.href];
  const doneCount = guide.steps.filter((s) => stateOf(s)?.state === "done").length;
  const total = guide.steps.length;
  const allDone = total > 0 && doneCount === total;
  const nextUpHref = guide.steps.find((s) => stateOf(s)?.state !== "done")?.href ?? null;

  return (
    <div className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-indigo,#2E78F5)]">{guide.stageLabel}</p>
      <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{guide.title}</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{guide.intro}</p>

      {/* The real gate: what actually unlocks the next stage (source of truth). */}
      {gate && (
        <div className="mt-4">
          <StageGatePanel gate={gate} />
        </div>
      )}

      {showManualOutreachBanner ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 flex-none text-amber-600" aria-hidden="true" />
          <p className="flex-1 text-sm text-amber-900">
            Manual outreach not started. Your Outreach step isn&apos;t complete until you send your first manual email.
          </p>
          <Link
            href="/founder/deploy?step=outreach&mode=manual"
            className="flex-none text-sm font-semibold text-amber-900 hover:underline"
          >
            Start
          </Link>
        </div>
      ) : null}

      {progress && progress.overall !== null && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Materials progress <span className="text-slate-400">· helps your rating</span></span>
            <span>{progress.overall}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.overall}%` }} />
          </div>
        </div>
      )}

      {/* Completion summary: tells the founder what they don't need to revisit. */}
      {progress && allDone ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-6 w-6 flex-none text-emerald-600" aria-hidden="true" />
          <div className="flex-1 text-sm text-emerald-900">
            <p className="font-semibold">Stage {stageNumber ?? ""} complete</p>
            <p>Nothing left here. Edit any step anytime.</p>
          </div>
          {nextStageSlug ? (
            <Link
              href={`/founder/stages/${nextStageSlug}`}
              className="inline-flex flex-none items-center gap-1 text-sm font-semibold text-emerald-900 hover:underline"
            >
              Next stage <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      ) : progress && doneCount > 0 ? (
        <div className="mt-6 rounded-xl border border-[var(--brand-indigo,#2E78F5)]/20 bg-[var(--brand-indigo,#2E78F5)]/5 px-4 py-3 text-sm text-[var(--brand-indigo,#2E78F5)]">
          <p className="font-semibold">
            {doneCount} of {total} done
          </p>
          <p>Completed steps are saved. Open one only if you want to edit it.</p>
        </div>
      ) : null}

      <ol className="mt-8 space-y-0">
        {guide.steps.map((step, i) => {
          const last = i === guide.steps.length - 1;
          const sp = stateOf(step);
          const done = sp?.state === "done";
          const nextUp = !done && step.href === nextUpHref;
          const label = pctLabel(sp);
          const openHref = step.openHref ?? step.href;

          return (
            <li key={step.title} className="flex gap-4">
              {/* number + connector rail */}
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
                    done
                      ? "bg-emerald-500"
                      : nextUp
                        ? "bg-[var(--brand-indigo,#2E78F5)]"
                        : sp?.state === "not_started" || sp?.state === "unknown"
                          ? "bg-slate-300"
                          : "bg-[var(--brand-indigo,#2E78F5)]"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                {!last && <span className="w-px flex-1 bg-[var(--border-subtle)]" />}
              </div>

              <div className={`flex-1 ${last ? "pb-0" : done ? "pb-4" : "pb-8"}`}>
                {done ? (
                  /* Completed: one line, date, and an Edit link. No need to go back. */
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</h3>
                      <p className="text-xs text-emerald-700">{completedLabel(sp)}</p>
                      {sp?.note ? (
                        <p className="mt-1.5 inline-block rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{sp.note}</p>
                      ) : null}
                    </div>
                    <Link
                      href={openHref}
                      onClick={() => recordVisit(step)}
                      className="inline-flex flex-none items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </Link>
                  </div>
                ) : (
                  <div
                    className={`rounded-xl bg-white p-4 ${
                      nextUp ? "border-2 border-[var(--brand-indigo,#2E78F5)]" : "border border-[var(--border-subtle)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</h3>
                      <div className="flex flex-none items-center gap-2">
                        {label ? (
                          <span
                            className={`text-xs font-medium ${
                              sp?.badge
                                ? "rounded-full bg-amber-50 px-2 py-0.5 text-amber-700"
                                : sp?.state === "not_started"
                                  ? "text-slate-400"
                                  : "text-slate-500"
                            }`}
                          >
                            {label}
                          </span>
                        ) : null}
                        {nextUp ? (
                          <span className="rounded-full bg-[var(--brand-indigo,#2E78F5)]/10 px-2 py-0.5 text-xs font-medium text-[var(--brand-indigo,#2E78F5)]">
                            Next up
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {sp && sp.percent !== null && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[var(--brand-indigo,#2E78F5)]"
                          style={{ width: `${Math.max(sp.percent, 2)}%` }}
                        />
                      </div>
                    )}
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{step.desc}</p>
                    {sp?.note ? (
                      <p className="mt-2 inline-block rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{sp.note}</p>
                    ) : null}

                    {sp?.parts?.length ? (
                      <div className="mt-3 grid gap-2">
                        {sp.parts.map((part) => (
                          <div
                            key={part.key}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                              part.done ? "border border-slate-200" : "border border-amber-300"
                            }`}
                          >
                            {part.done ? (
                              <CheckCircle2 className="h-5 w-5 flex-none text-emerald-600" aria-hidden="true" />
                            ) : (
                              <CircleDashed className="h-5 w-5 flex-none text-amber-600" aria-hidden="true" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--text-primary)]">{part.label}</p>
                              <p className="text-xs text-[var(--text-muted)]">{part.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={openHref}
                        onClick={() => recordVisit(step)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                      >
                        {step.hrefLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>

                      {step.ai.kind === "tool" ? (
                        <Link href={step.ai.href} className={AI_BTN}>
                          <Sparkles className="h-3.5 w-3.5" />
                          {step.ai.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => askAssistant(step.ai.kind === "assistant" ? step.ai.prompt : "")}
                          className={AI_BTN}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {step.ai.label ?? "Ask AI"}
                        </button>
                      )}
                    </div>
                    {step.doneOnVisit && sp?.state !== "done" && sp?.percent === null ? (
                      <p className="mt-2 text-xs text-slate-400">Marked done once you open it</p>
                    ) : null}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
