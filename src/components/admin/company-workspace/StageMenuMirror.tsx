import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";
import { getStageMirror, stageLabel, type MirrorItemStatus } from "@/lib/admin/stage-menu-mirror";
import { OpenFounderItem } from "@/components/admin/company-workspace/OpenFounderItem";

const STATUS_META: Record<MirrorItemStatus, { label: string; chip: string; icon: string; iconColor: string }> = {
  done: { label: "Done", chip: "bg-emerald-50 text-emerald-700", icon: "ti-circle-check", iconColor: "text-emerald-600" },
  attention: { label: "Attention", chip: "bg-amber-50 text-amber-700", icon: "ti-alert-circle", iconColor: "text-amber-600" },
  missing: { label: "Missing", chip: "bg-red-50 text-red-700", icon: "ti-circle-x", iconColor: "text-red-600" },
  todo: { label: "Open", chip: "bg-slate-100 text-slate-500", icon: "ti-circle", iconColor: "text-slate-400" },
  locked: { label: "Not started", chip: "bg-slate-100 text-slate-400", icon: "ti-lock", iconColor: "text-slate-300" },
};

/**
 * Founder-menu mirror for one stage tab: a recommendation strip plus the founder's
 * own menu for that stage with per-item status. "Open" links to the founder route;
 * Phase 3 upgrades it to permission-gated act-on-behalf.
 */
export function StageMenuMirror({
  journey,
  stage,
  founderId = null,
  canActOnBehalf = false,
}: Readonly<{ journey: FounderJourneyState; stage: JourneyStage; founderId?: string | null; canActOnBehalf?: boolean }>) {
  const mirror = getStageMirror(journey, stage);

  return (
    <div className="space-y-3">
      {/* Recommendation strip */}
      <div className="flex items-start gap-2.5 rounded-lg bg-indigo-50 px-3 py-2.5">
        <i className="ti ti-sparkles mt-0.5 text-indigo-600" aria-hidden="true" />
        <p className="text-[12.5px] leading-relaxed text-indigo-900">{mirror.recommendation}</p>
      </div>

      {/* Founder-menu mirror */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-3.5 py-2">
          <p className="text-[11px] font-semibold text-slate-600">
            Founder&apos;s {stageLabel(stage)} menu
            <span className="font-normal text-slate-400">
              {" "}· {mirror.reached ? `${mirror.doneCount} of ${mirror.total} done` : "not reached"}
            </span>
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {mirror.items.map((item) => {
            const meta = STATUS_META[item.status];
            return (
              <li key={item.label} className="flex items-center gap-3 px-3.5 py-2.5">
                <i className={`ti ${meta.icon} ${meta.iconColor} text-[17px]`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{item.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>{meta.label}</span>
                <OpenFounderItem href={item.href} founderId={founderId} canActOnBehalf={canActOnBehalf} />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
