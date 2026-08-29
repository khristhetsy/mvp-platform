import Link from "next/link";
import { Check, ArrowRight, Clock, Lock, AlertTriangle } from "lucide-react";
import type { StageGate, GateItem } from "@/lib/founder/stage-gate-status";

/**
 * The "path to the next stage" panel shown at the top of a stage guide. Driven by
 * the REAL gate (getStageGateStatus) — so it always reflects what actually unlocks
 * the next stage, not the guide's task tally. Single-stage: renders the stage the
 * founder is on (detailed), or a compact done/locked line for other stages.
 */
export function StageGatePanel({ gate }: { gate: StageGate }) {
  const activeCount = gate.items.filter((i) => i.state === "active").length;
  const chip =
    gate.relation === "complete"
      ? { text: "Complete", cls: "bg-emerald-50 text-emerald-700" }
      : gate.relation === "locked"
        ? { text: "Locked", cls: "bg-slate-100 text-slate-500" }
        : gate.review?.status === "pending"
          ? { text: "Under review", cls: "bg-blue-50 text-blue-700" }
          : activeCount > 0
            ? { text: activeCount === 1 ? "1 thing left" : `${activeCount} things left`, cls: "bg-amber-50 text-amber-700" }
            : { text: "Ready", cls: "bg-emerald-50 text-emerald-700" };

  const accent = gate.relation === "current" ? "border-2 border-[var(--brand-indigo,#2E78F5)]" : "border border-[var(--border-subtle)]";

  return (
    <section className={`rounded-2xl bg-white p-4 ${accent} ${gate.relation !== "current" ? "opacity-90" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          {gate.relation === "locked" ? <Lock className="h-4 w-4 text-slate-400" /> : null}
          {gate.headline}
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${chip.cls}`}>{chip.text}</span>
      </div>

      {gate.relation !== "current" ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">{gate.summary}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2.5">
            {gate.items.map((item) => (
              <GateRow key={item.label} item={item} />
            ))}
          </ul>

          {gate.review?.status === "pending" ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <Clock className="mt-0.5 h-4 w-4 flex-none text-slate-400" />
              <span>
                Submitted for review. The iCFO team typically decides within ~2 business days, and we&rsquo;ll email you the moment {gate.nextStageName ?? "the next stage"} opens.
              </span>
            </div>
          ) : gate.review?.status === "rejected" ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-500" />
              <span>Changes requested{gate.review.feedback ? `: ${gate.review.feedback}` : ". See the notes and resubmit."}</span>
            </div>
          ) : activeCount === 0 && gate.slug === "preparation" ? (
            <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
              All set — you&rsquo;ll be submitted for a quick iCFO review, then {gate.nextStageName} opens. We&rsquo;ll email you.
            </p>
          ) : null}

          {gate.primaryCta ? (
            <div className="mt-4">
              <Link
                href={gate.primaryCta.href}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-indigo,#2E78F5)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {gate.primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function GateRow({ item }: { item: GateItem }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex-none">
        {item.state === "done" ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3 w-3" />
          </span>
        ) : item.state === "active" ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-semibold text-white">!</span>
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-400">·</span>
        )}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--text-primary)]">{item.label}</div>
        {item.detail ? <div className="text-xs text-[var(--text-muted)]">{item.detail}</div> : null}
        {item.state === "active" && item.cta ? (
          <Link href={item.cta.href} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-indigo,#2E78F5)] hover:underline">
            {item.cta.label} <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}
