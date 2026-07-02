import Link from "next/link";
import { useTranslations } from "next-intl";
import { computeDataRoomState, DATA_ROOM_UNLOCKS } from "@/lib/data-room/completeness";
import type { DocumentRecord } from "@/lib/supabase/types";

/**
 * The single most important founder-facing surface: how complete is your data
 * room, what's left, the fastest way to finish each item, and what completion
 * unlocks (investor access). Server component — pass the company's documents.
 */
export function DataRoomReadinessCard({
  documents,
  showAllItems = true,
}: {
  documents: DocumentRecord[];
  showAllItems?: boolean;
}) {
  const t = useTranslations("founderCmp");
  const state = computeDataRoomState(documents);
  const complete = state.fullComplete;

  const ringColor = complete ? "#1D9E75" : state.coreComplete ? "#534AB7" : "#BA7517";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{t("due_diligence")}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {complete ? "Your data room is investor-ready" : "Get investor-ready"}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            {complete
              ? "Every required document is in. Our team can run diligence and investors can see a complete data room."
              : "Investors fund founders who are easy to diligence. Complete your data room to unlock investor access."}
          </p>
        </div>

        {/* Progress ring */}
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 flex-none">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#E2E8F0" strokeWidth="8" />
              <circle
                cx="40" cy="40" r="34" fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(state.percent / 100) * 2 * Math.PI * 34} ${2 * Math.PI * 34}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold text-slate-900">{state.percent}%</span>
              <span className="text-[10px] text-slate-500">{state.completed}/{state.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Core (investor-access) progress */}
      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-800">
            Investor-access essentials
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${state.coreComplete ? "bg-[#E1F5EE] text-[#0F6E56]" : "bg-[#FAEEDA] text-[#854F0B]"}`}>
            {state.coreCompleted}/{state.coreTotal} done
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full" style={{ width: `${(state.coreCompleted / Math.max(1, state.coreTotal)) * 100}%`, background: state.coreComplete ? "#1D9E75" : "#534AB7" }} />
        </div>
        {!state.coreComplete && (
          <p className="mt-2 text-xs text-slate-600">
            These three unlock: {DATA_ROOM_UNLOCKS.join(" · ").toLowerCase()}.
          </p>
        )}
      </div>

      {/* Next best step */}
      {state.nextItem && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <div className="text-sm">
            <span className="font-semibold text-indigo-900">Next: {state.nextItem.label}</span>
            <span className="ml-2 text-indigo-700">
              {state.nextItem.path === "generate" ? "You can create this in-app." : "Upload the file when ready."}
            </span>
          </div>
          <Link href={state.nextItem.href} className="cap-btn-primary inline-flex flex-none items-center rounded-lg px-3.5 py-2 text-sm font-medium">
            {state.nextItem.cta} →
          </Link>
        </div>
      )}

      {/* Item checklist */}
      {showAllItems && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {state.items.map((item) => {
            const done = item.status !== "missing";
            return (
              <li key={item.code} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`inline-flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] ${done ? "bg-[#1D9E75] text-white" : "border border-slate-300 text-transparent"}`}>✓</span>
                  <span className="truncate text-sm text-slate-700">
                    {item.label}
                    {item.core && <span className="ml-1.5 rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-700">core</span>}
                  </span>
                </span>
                {done ? (
                  <span className="flex-none text-[11px] font-medium text-emerald-700">
                    {item.status === "needs_review" ? "In review" : "Added"}
                  </span>
                ) : (
                  <Link href={item.href} className="flex-none rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
                    {item.cta}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!complete && (
        <div className="mt-4 flex items-center justify-between">
          <Link href="/founder/readiness/data-room" className="text-sm font-medium text-indigo-700 hover:underline">
            Open the data room checklist →
          </Link>
          <span className="text-xs text-slate-500">{state.missingCount} document{state.missingCount === 1 ? "" : "s"} left</span>
        </div>
      )}
    </section>
  );
}
