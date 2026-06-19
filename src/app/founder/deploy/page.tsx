import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { buildFounderInvestorCrmView } from "@/lib/data/investor-crm";
import type { FounderInvestorRelationRow } from "@/lib/data/investor-crm";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import {
  formatPledgeTotal,
  getCompanyPledgeSummary,
  getFounderPledgeCompanyId,
} from "@/lib/data/investor-pledges";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

type FunnelStage = { label: string; value: number };

const STAGE_BADGE: Record<FounderInvestorRelationRow["actionType"], string> = {
  pledged: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  indicative_interest: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  intro_requested: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  interested: "bg-slate-50 text-slate-600 ring-slate-200",
  saved_deal: "bg-slate-50 text-slate-600 ring-slate-200",
  follow_up: "bg-amber-50 text-amber-800 ring-amber-100",
};

function formatRowAmount(row: FounderInvestorRelationRow): string | null {
  const currency = row.pledgeCurrency ?? "USD";
  if (row.pledgeAmount && row.pledgeAmount > 0) return formatPledgeTotal(row.pledgeAmount, currency);
  if (row.interestAmount && row.interestAmount > 0) return formatPledgeTotal(row.interestAmount, currency);
  return null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

/** Prioritised, de-duplicated investor list: follow-ups first, then intros, new interest, pledged. */
function buildPipelineList(view: ReturnType<typeof buildFounderInvestorCrmView>): FounderInvestorRelationRow[] {
  const ordered = [
    ...view.sections.followUpNeeded,
    ...view.sections.introRequested,
    ...view.sections.newInterest,
    ...view.sections.pledged,
  ];
  const seen = new Set<string>();
  const result: FounderInvestorRelationRow[] = [];
  for (const row of ordered) {
    if (seen.has(row.investorId)) continue;
    seen.add(row.investorId);
    result.push(row);
    if (result.length >= 12) break;
  }
  return result;
}

function FunnelBar({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stages.map((stage) => (
        <div key={stage.label} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-semibold text-slate-900">{stage.value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{stage.label}</p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-indigo-500"
              style={{ width: `${Math.round((stage.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ToolLaunchers() {
  const tools = [
    { label: "Sequence builder", topic: "Build a multi-step outreach sequence" },
    { label: "Outreach coach", topic: "Get coaching on investor messaging" },
    { label: "Update broadcaster", topic: "Send an investor update" },
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

export default async function FounderDeployPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);

  let crmView: ReturnType<typeof buildFounderInvestorCrmView> | null = null;
  if (company) {
    const supabase = await createServerSupabaseClient();
    const serviceSupabase = createServiceRoleClient();
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    const [activity, pledgeSummary] = await Promise.all([
      listFounderInvestorActivity(supabase, company.id),
      getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId),
    ]);
    crmView = buildFounderInvestorCrmView(activity, pledgeSummary);
  }

  const funnel: FunnelStage[] = [
    { label: "Interested", value: crmView?.summary.totalInterestedInvestors ?? 0 },
    { label: "Intro requested", value: crmView?.summary.introRequests ?? 0 },
    { label: "Follow-up", value: crmView?.summary.followUpsNeeded ?? 0 },
    { label: "Pledged", value: crmView?.sections.pledged.length ?? 0 },
  ];
  const pipelineList = crmView ? buildPipelineList(crmView) : [];
  const followUpsNeeded = crmView?.summary.followUpsNeeded ?? 0;

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <FounderJourneyGate minStage="deploy">
        <FounderFeatureGate featureKey="investor_access">
          <div className="mb-4">
            <Link
              href="/founder/journey"
              className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              ← Founder journey
            </Link>
          </div>

          <PageHeader
            eyebrow="Stage 3 · Deploy"
            title="Run your raise"
            description="Track your investor pipeline, keep momentum with follow-ups, and run outreach to close your round."
            actions={
              <Link
                href="/founder/investors"
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Open full investor CRM →
              </Link>
            }
          />

          {/* Pipeline funnel */}
          <FunnelBar stages={funnel} />

          {/* Follow-up nudge */}
          {followUpsNeeded > 0 ? (
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-900">
                {followUpsNeeded} investor{followUpsNeeded === 1 ? "" : "s"} need a follow-up — keep your raise
                moving.
              </p>
              <Link
                href="/founder/investors"
                className="shrink-0 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-500"
              >
                Review follow-ups →
              </Link>
            </div>
          ) : null}

          {/* Investor pipeline list */}
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-medium text-slate-900">Investor pipeline</h2>
            {pipelineList.length === 0 ? (
              <EmptyState
                title="No investor activity yet"
                description="As investors express interest or request intros, they'll appear here. Start outreach to build your pipeline."
                secondaryActionLabel="Open investor CRM"
                secondaryActionHref="/founder/investors"
              />
            ) : (
              <ul className="space-y-2">
                {pipelineList.map((row) => {
                  const amount = formatRowAmount(row);
                  const isFollowUp = row.actionType === "follow_up" || row.pipelineStage === "follow_up";
                  return (
                    <li
                      key={row.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                        {initials(row.investorName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{row.investorName}</p>
                        <p className="text-xs text-slate-500">
                          {amount ? `${amount} · ` : ""}
                          {formatDate(row.lastActivityAt)}
                        </p>
                      </div>
                      <span
                        className={[
                          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
                          STAGE_BADGE[row.actionType],
                        ].join(" ")}
                      >
                        {row.actionLabel}
                      </span>
                      {isFollowUp ? (
                        <Link
                          href="/founder/investors"
                          className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          Nudge
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Outreach tools */}
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-medium text-slate-900">Outreach tools</h2>
            <ToolLaunchers />
          </section>
        </FounderFeatureGate>
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
