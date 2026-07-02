import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import {
  formatPledgeTotal,
  getCompanyPledgeSummary,
  getFounderPledgeCompanyId,
} from "@/lib/data/investor-pledges";
import { listFounderCompanyUpdates } from "@/lib/company-updates/company-updates";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type Milestone = { label: string; detail: string; met: boolean };

/** Whole days between an ISO timestamp and now. Module-level to keep render pure. */
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function CheckIcon({ met }: { met: boolean }) {
  if (met) {
    return (
      <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg
      className="h-5 w-5 text-slate-300"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function ToolLaunchers() {
  const tools = [
    { label: "Round health advisor", topic: "Check the health of your active raise" },
    { label: "Board meeting prep", topic: "Prepare for your next board meeting" },
    { label: "Funding timeline", topic: "Plan milestones to your close" },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tools.map((tool) => (
        <div
          key={tool.label}
          className="flex flex-col rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">{tool.label}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Soon
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{tool.topic}</p>
        </div>
      ))}
    </div>
  );
}

export default async function FounderOptimizePage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);

  const supabase = await createServerSupabaseClient();
  const serviceSupabase = createServiceRoleClient();

  let totalPledged = 0;
  let investorCount = 0;
  let currency = "USD";
  let dealRoomCount = 0;
  let daysSinceUpdate: number | null = null;

  if (company) {
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    const pledgeSummary = await getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId);
    totalPledged = pledgeSummary.totalPledged;
    investorCount = pledgeSummary.investorCount;
    currency = pledgeSummary.currency;

    type CountRow = { id: string };
    const drResult = await supabase.from("deal_rooms").select("id").eq("company_id", company.id);
    dealRoomCount = ((drResult as { data: CountRow[] | null }).data ?? []).length;

    const updatesResult = await listFounderCompanyUpdates(supabase, company.id);
    const updates = ("data" in updatesResult ? updatesResult.data : []) ?? [];
    const lastUpdate = updates[0] as { created_at?: string | null } | undefined;
    if (lastUpdate?.created_at) {
      daysSinceUpdate = daysSince(lastUpdate.created_at);
    }
  }

  const target = company?.funding_amount ?? 0;
  const closePercent = target > 0 ? Math.min(100, Math.round((totalPledged / target) * 100)) : 0;
  const remaining = Math.max(0, target - totalPledged);
  const isClosed = target > 0 && totalPledged >= target;

  const milestones: Milestone[] = [
    {
      label: "First investor committed",
      detail: investorCount > 0 ? `${investorCount} committed` : "No commitments yet",
      met: investorCount > 0,
    },
    {
      label: "Half the round committed",
      detail: target > 0 ? `${closePercent}% of target` : "Set a funding target",
      met: target > 0 && totalPledged >= target * 0.5,
    },
    {
      label: "Round fully closed",
      detail: isClosed ? "Closed" : `${formatPledgeTotal(remaining, currency)} to go`,
      met: isClosed,
    },
  ];

  const cadenceOverdue = daysSinceUpdate === null || daysSinceUpdate >= 30;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderJourneyGate minStage="optimize">
        <div className="mb-4">
          <Link
            href="/founder/journey"
            className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            ← Founder journey
          </Link>
        </div>

        <PageHeader
          eyebrow={t("stage_4_optimize")}
          title={t("manage_and_scale_your_raise")}
          description={t("track_your_round_close_keep_investors_updated")}
        />

        {/* Round close thermometer */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-slate-600">{t("round_close")}</h2>
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-900">{formatPledgeTotal(totalPledged, currency)}</span>
              {target > 0 ? ` of ${formatPledgeTotal(target, currency)}` : " committed"}
            </p>
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-semibold text-emerald-600">{closePercent}%</span>
            <span className="text-sm text-slate-500">
              {isClosed ? "Round closed" : `${formatPledgeTotal(remaining, currency)} remaining`}
            </span>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100">
            <div
              className="h-2.5 rounded-full bg-emerald-500"
              style={{ width: `${closePercent}%` }}
            />
          </div>
        </section>

        {/* Engagement metrics */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard value={String(investorCount)} label={t("committed_investors")} />
          <MetricCard value={String(dealRoomCount)} label={`Deal room${dealRoomCount === 1 ? "" : "s"}`} />
          <MetricCard
            value={daysSinceUpdate === null ? "—" : `${daysSinceUpdate}d`}
            label={t("since_last_update")}
          />
        </div>

        {/* Update cadence nudge */}
        {cadenceOverdue ? (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              {daysSinceUpdate === null
                ? "You haven't sent an investor update yet — committed investors expect a regular cadence."
                : `It's been ${daysSinceUpdate} days since your last investor update.`}
            </p>
            <Link
              href="/founder/capital-raise"
              className="shrink-0 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-500"
            >
              Send an update →
            </Link>
          </div>
        ) : null}

        {/* Milestones */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-slate-900">{t("milestones")}</h2>
          <ul className="space-y-2">
            {milestones.map((m) => (
              <li
                key={m.label}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <span className="shrink-0">
                  <CheckIcon met={m.met} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{m.label}</p>
                  <p className="text-xs text-slate-500">{m.detail}</p>
                </div>
                <span
                  className={[
                    "shrink-0 text-xs font-medium",
                    m.met ? "text-emerald-600" : "text-slate-400",
                  ].join(" ")}
                >
                  {m.met ? "Reached" : "In progress"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Ongoing tools */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-slate-900">{t("ongoing_tools")}</h2>
          <ToolLaunchers />
        </section>
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
