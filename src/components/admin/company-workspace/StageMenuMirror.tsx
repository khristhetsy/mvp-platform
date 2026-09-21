import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";
import { getStageMirror, stageLabel, type MirrorItemStatus } from "@/lib/admin/stage-menu-mirror";
import { OpenFounderItem } from "@/components/admin/company-workspace/OpenFounderItem";
import { ReachOutPanel } from "@/components/admin/company-workspace/ReachOutPanel";
import { StageItemDrawer } from "@/components/admin/company-workspace/StageItemDrawer";
import type { StageDiagnosis } from "@/lib/admin/stage-diagnosis";

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
  companyId = null,
  founderName = "the founder",
  founderEmail = null,
  reachOutHref,
  diagnosis = null,
}: Readonly<{
  journey: FounderJourneyState;
  stage: JourneyStage;
  founderId?: string | null;
  canActOnBehalf?: boolean;
  companyId?: string | null;
  founderName?: string;
  founderEmail?: string | null;
  /** When set, the banner shows a jump-link to a combined reach-out card instead of
   *  opening its own modal (avoids two entry points on stages that render that card). */
  reachOutHref?: string;
  /** Per-item diagnosis, keyed by founder route. Resolved on the server by
   *  `diagnoseStage` and threaded through the workspace loader, because the
   *  parent workspace is a client component and cannot render an async child. */
  diagnosis?: StageDiagnosis | null;
}>) {
  const mirror = getStageMirror(journey, stage);
  const pendingItems = mirror.items.filter((i) => i.status === "attention" || i.status === "missing").map((i) => i.label);

  const byHref = diagnosis?.byHref ?? {};
  const situation = diagnosis?.situation ?? "blocking";
  const summary = diagnosis?.summary ?? "";
  const facts = diagnosis?.facts ?? [];

  // One action, in this card's own header. It used to sit inside the strip while
  // a second, fuller "Reach out" card rendered above the same menu — two entry
  // points to the same email.
  const reachOut = companyId ? (
    reachOutHref ? (
      <a
        href={reachOutHref}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <i className="ti ti-mail" aria-hidden="true" /> Reach out to founder
      </a>
    ) : (
      <ReachOutPanel
        companyId={companyId}
        founderName={founderName}
        founderEmail={founderEmail}
        stageLabel={stageLabel(stage)}
        pendingItems={pendingItems}
        facts={facts}
        situation={situation}
      />
    )
  ) : null;

  return (
    <div className="space-y-3">
      {/* Recommendation strip — text only now; the action lives in the card header. */}
      <div className="flex items-start gap-2.5 rounded-lg bg-indigo-50 px-3 py-2.5">
        <i className="ti ti-sparkles mt-0.5 text-indigo-600" aria-hidden="true" />
        <p className="flex-1 text-[12.5px] leading-relaxed text-indigo-900">{summary || mirror.recommendation}</p>
      </div>

      {/* Founder-menu mirror */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-3.5 py-2">
          <p className="min-w-0 flex-1 text-[11px] font-semibold text-slate-600">
            Founder&apos;s {stageLabel(stage)} menu
            <span className="font-normal text-slate-400">
              {" "}· {mirror.reached ? `${mirror.doneCount} of ${mirror.measuredCount} measured items done · ${mirror.total - mirror.measuredCount} not tracked` : "not reached"}
            </span>
          </p>
          {pendingItems.length > 0 ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">
              {pendingItems.length} blocking
            </span>
          ) : null}
          {reachOut}
        </div>
        <ul className="divide-y divide-slate-100">
          {mirror.items.map((item) => {
            const meta = STATUS_META[item.status];
            return (
              <li key={item.label}>
                {/* Row contents are unchanged — the drawer only adds the caret and
                    the panel beneath, and keeps the Open controls outside the toggle. */}
                <StageItemDrawer
                  diagnosis={byHref[item.href] ?? null}
                  actions={
                    <OpenFounderItem href={item.href} founderId={founderId} canActOnBehalf={canActOnBehalf} actable={item.actable} />
                  }
                >
                  <i className={`ti ${meta.icon} ${meta.iconColor} text-[17px]`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{item.label}</span>
                  {byHref[item.href]?.measured ? (
                    <span className="hidden truncate text-[11.5px] text-slate-500 lg:inline">
                      {byHref[item.href].headline}
                    </span>
                  ) : null}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>{meta.label}</span>
                </StageItemDrawer>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
