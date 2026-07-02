import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Lock, Sparkles, ArrowRight } from "lucide-react";
import type { InvestorStageView } from "@/lib/investor-journey/stages";
import type { InvestorStageCoach } from "@/lib/investor-journey/coach";

const DOT = {
  complete: "bg-emerald-100 text-emerald-700",
  current: "bg-indigo-600 text-white ring-4 ring-indigo-100",
  locked: "bg-slate-100 text-slate-400",
} as const;

export function InvestorJourneyTracker({
  stageView,
  coach,
}: Readonly<{ stageView: InvestorStageView; coach: InvestorStageCoach }>) {
  const t = useTranslations("investorCmp");
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">{t("your_journey")}</p>
        <p className="text-[11px] text-slate-400">{stageView.percent}% complete</p>
      </div>

      {/* Stage strip */}
      <ol className="mt-4 grid grid-cols-4 gap-0">
        {stageView.stages.map((stage, i) => (
          <li key={stage.key} className="relative text-center">
            {i < stageView.stages.length - 1 ? (
              <span
                className={`absolute top-[18px] left-1/2 h-0.5 w-full ${stage.status === "complete" ? "bg-emerald-200" : "bg-slate-200"}`}
                aria-hidden
              />
            ) : null}
            <span className={`relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full ${DOT[stage.status]}`}>
              {stage.status === "complete" ? (
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              ) : stage.status === "locked" ? (
                <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              ) : (
                <span className="text-sm font-semibold">{stage.number}</span>
              )}
            </span>
            <p className={`mt-2 text-[13px] font-medium ${stage.status === "current" ? "text-indigo-700" : stage.status === "locked" ? "text-slate-400" : "text-slate-700"}`}>
              {stage.label}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {stage.status === "current" ? "You're here" : stage.status === "complete" ? "Done" : `Stage ${stage.number}`}
            </p>
          </li>
        ))}
      </ol>

      {/* Contextual coach — the one next step */}
      <div className="mt-5 flex flex-col gap-3 rounded-xl bg-indigo-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" strokeWidth={1.9} aria-hidden />
          <div>
            <p className="text-[13px] font-semibold text-slate-900">{coach.headline}</p>
            <p className="mt-0.5 text-[13px] leading-6 text-slate-600">{coach.body}</p>
            {coach.scoreHint ? (
              <p className="mt-1 text-[12px] font-medium text-indigo-700">{coach.scoreHint}</p>
            ) : null}
          </div>
        </div>
        {coach.action ? (
          <Link
            href={coach.action.href}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:self-center"
          >
            {coach.action.label}
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
