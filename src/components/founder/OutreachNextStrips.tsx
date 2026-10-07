import Link from "next/link";
import { AlertTriangle, CalendarClock, MailCheck } from "lucide-react";
import type { NextBatch, NextManualStep } from "@/lib/outreach/outreach-next-batch";
import { formatRunDay, formatRunTime } from "@/lib/outreach/outreach-schedule";

function namesLine(names: string[], limit = 3): string {
  const clean = names.filter(Boolean);
  if (clean.length <= limit) {
    if (clean.length <= 1) return clean.join("");
    return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
  }
  return `${clean.slice(0, limit).join(", ")} and ${clean.length - limit} more`;
}

const chip = "rounded-full px-2.5 py-0.5 text-[11px] font-medium";

/** Automated outreach: when the next batch goes out, to whom, and what could hold it. */
export function NextBatchStrip({ batch }: { batch: NextBatch }) {
  if (batch.blocked === "unpublished") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p className="text-sm text-amber-900">
            Next batch is waiting: your one-pager isn&apos;t published. Publish it and the batch goes out at the next run,{" "}
            {formatRunTime(batch.runAt)}.
          </p>
        </div>
        <Link href="/founder/settings" className="shrink-0 self-start sm:self-auto rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">
          Publish one-pager
        </Link>
      </div>
    );
  }

  if (batch.blocked === "no_plan") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p className="text-sm text-amber-900">Outreach is on hold: your plan doesn&apos;t include investor outreach. Your matches stay ready.</p>
        </div>
        <Link href="/founder/settings/billing" className="shrink-0 self-start sm:self-auto rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">
          Choose a plan
        </Link>
      </div>
    );
  }

  const shown = batch.investors.slice(0, batch.upTo || batch.investors.length);
  const who =
    shown.length > 0
      ? `${shown.length} ${shown.length === 1 ? "investor" : "investors"}: ${namesLine(shown.map((i) => i.name))}.`
      : `Up to ${batch.upTo} matched ${batch.upTo === 1 ? "investor" : "investors"}.`;
  const resets = batch.periodResetsAt ? formatRunDay(batch.periodResetsAt).split(", ").slice(1).join(", ") : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-white px-4 py-3 sm:flex-row sm:items-start">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <CalendarClock className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Next batch: {formatRunTime(batch.runAt)}</p>
        <p className="mt-0.5 text-xs text-slate-600">
          {batch.blocked === "cap_reached"
            ? `You've used this period's allowance, so the next batch goes out after it resets. ${who}`
            : `${who} Your one-pager goes out as it is at that moment.`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`${chip} bg-emerald-50 text-emerald-700`}>One-pager published</span>
          {batch.periodCap !== null ? (
            <span className={`${chip} bg-slate-100 text-slate-600`}>
              {batch.reachedThisPeriod} of {batch.periodCap} used this period{resets ? ` · resets ${resets}` : ""}
            </span>
          ) : null}
          <span className={`${chip} bg-slate-100 text-slate-600`}>Reminder email the day before</span>
        </div>
      </div>
      <Link
        href="/founder/preview"
        className="shrink-0 self-start rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Review one-pager
      </Link>
    </div>
  );
}

/** DIY outreach: the next sequence step that will send. */
export function NextManualStepStrip({ step }: { step: NextManualStep }) {
  const hh = String(step.runAt.getUTCHours()).padStart(2, "0");
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-slate-900">
          Next sequence step: {step.label || `Step ${step.stepIndex + 1}`} on {formatRunDay(step.runAt)}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          Goes to {step.recipients} {step.recipients === 1 ? "investor" : "investors"} around {hh}:00 UTC. You&apos;ll get an email and a
          notification after each step sends.
        </p>
      </div>
    </div>
  );
}
