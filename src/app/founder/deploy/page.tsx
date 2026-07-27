import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
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
import { loadPartnerScoresBatch } from "@/lib/investor-rating/snapshot";
import { founderFacingPartnerView, type FounderFacingPartner } from "@/lib/investor-rating/founder-view";
import { loadFounderInvestorBoard } from "@/lib/founder/private-market";
import { buildProfileCompletion } from "@/lib/data/founder-readiness";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import { loadFounderInvestorHub } from "@/lib/founder-crm/load-founder-investor-hub";
import { FounderInvestorHubPanels } from "@/components/FounderInvestorHubPanels";
import { ensureFounderAutomatedOutreach } from "@/lib/outreach/investor-outreach";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { FounderFacingInvestorTier } from "@/components/founder/FounderFacingInvestorTier";
import { FounderPrivateMarketBoard } from "@/components/founder/FounderPrivateMarketBoard";
import { FounderPrivateMarketSummaryCards } from "@/components/founder/FounderPrivateMarketSummaryCards";
import { FounderPrivateMarketTicker } from "@/components/founder/FounderPrivateMarketTicker";
import { DeployWorkflow, type DeployAnalytics, type DeployInsight } from "@/components/founder/DeployWorkflow";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

const OUTREACH_THRESHOLD = 70;

/** Outreach & planning tools — relocated from the sidebar into Deploy → Outreach → Manual. */
const MANUAL_TOOLS: { href: string; label: string; blurb: string }[] = [
  { href: "/founder/email-sequence", label: "Email sequences", blurb: "Build a multi-step, personalised investor sequence." },
  { href: "/founder/investor-update", label: "Investor update builder", blurb: "Draft and send a polished monthly update." },
  { href: "/founder/funding-timeline", label: "Funding timeline", blurb: "Map milestones and target close dates." },
  { href: "/founder/due-diligence", label: "Due diligence checklist", blurb: "Track what investors will ask for before they commit." },
];

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

/** Turn the real pipeline numbers into expandable AI insight cards for the Analytics step. */
function buildDeployInsights(input: {
  investableScore: number;
  followUpsNeeded: number;
  interestedCount: number;
  pledgedCount: number;
  reachedOut: number;
  strongCount: number;
  published: boolean;
}): DeployInsight[] {
  const insights: DeployInsight[] = [];

  if (input.investableScore < OUTREACH_THRESHOLD) {
    insights.push({
      id: "score-gate",
      title: `Investable Score is ${input.investableScore} — automation is paused`,
      summary: `Automated outreach unlocks at ${OUTREACH_THRESHOLD}. You are ${OUTREACH_THRESHOLD - input.investableScore} point${OUTREACH_THRESHOLD - input.investableScore === 1 ? "" : "s"} away.`,
      recommendations: [
        "Finish any missing profile fields — description, funding amount, and use of funds move the score most.",
        "Upload the remaining required documents in Readiness to lift the readiness component.",
        "Until then, work the Manual tab so momentum doesn't stall.",
      ],
      tone: "warn",
    });
  } else {
    insights.push({
      id: "score-ok",
      title: "Automated outreach is live",
      summary: `Your Investable Score of ${input.investableScore} clears the ${OUTREACH_THRESHOLD} threshold.`,
      recommendations: [
        "No action needed — approved investors are surfaced automatically.",
        "Keep your profile current so the score stays above the threshold.",
      ],
      tone: "good",
    });
  }

  if (!input.published) {
    insights.push({
      id: "not-published",
      title: "Your public profile isn't published",
      summary: "Investors can't see your one-pager until you publish it, which caps both outreach lanes.",
      recommendations: [
        "Open Step 1 · Public Profile and toggle Publish once the preview looks right.",
        "Confirm the description and raise amount read well before you flip it live.",
      ],
      tone: "warn",
    });
  }

  if (input.followUpsNeeded > 0) {
    insights.push({
      id: "followups",
      title: `${input.followUpsNeeded} investor${input.followUpsNeeded === 1 ? "" : "s"} waiting on a follow-up`,
      summary: "Follow-up debt is the fastest thing to lose a warm investor over.",
      recommendations: [
        "Clear the follow-ups in the Manual tab first — they're already interested.",
        "Turn on follow-up reminders in Settings so none slip again.",
      ],
      tone: "warn",
    });
  }

  if (input.strongCount > 0 && input.reachedOut === 0) {
    insights.push({
      id: "strong-untouched",
      title: `${input.strongCount} strong-fit investor${input.strongCount === 1 ? "" : "s"} not yet contacted`,
      summary: "High-fit matches are surfaced but no outreach has gone out to them.",
      recommendations: [
        "If automation is live, it will reach them on the next pass — no action needed.",
        "For the very best fits, add a personal manual note to stand out.",
      ],
      tone: "info",
    });
  }

  if (input.interestedCount > 0 && input.pledgedCount === 0) {
    insights.push({
      id: "no-pledge",
      title: "Interest, but no pledges yet",
      summary: `${input.interestedCount} interested and zero pledged — the ask may need sharpening.`,
      recommendations: [
        "Use the Investor update builder to share a concrete milestone and a clear ask.",
        "Make sure your funding timeline shows a close date investors can rally to.",
      ],
      tone: "info",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "steady",
      title: "Nothing urgent — keep the cadence",
      summary: "No gaps in outreach right now.",
      recommendations: ["Check back after your next batch of activity for fresh recommendations."],
      tone: "good",
    });
  }

  return insights;
}

export default async function FounderDeployPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);

  let crmView: ReturnType<typeof buildFounderInvestorCrmView> | null = null;
  let pipelineList: FounderInvestorRelationRow[] = [];
  // Founder-facing investor standing (tier + facts only — never the score).
  const partnerViews = new Map<string, FounderFacingPartner>();
  let board: Awaited<ReturnType<typeof loadFounderInvestorBoard>> | null = null;
  let hub: Awaited<ReturnType<typeof loadFounderInvestorHub>> | null = null;
  let investableScore = 0;

  if (company) {
    const supabase = await createServerSupabaseClient();
    const serviceSupabase = createServiceRoleClient();
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    const [activity, pledgeSummary, loadedBoard, journeyState, loadedHub] = await Promise.all([
      listFounderInvestorActivity(supabase, company.id),
      getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId),
      loadFounderInvestorBoard(company),
      evaluateFounderJourney(supabase, profile.id),
      loadFounderInvestorHub(company, profile.id),
    ]);
    crmView = buildFounderInvestorCrmView(activity, pledgeSummary);
    pipelineList = buildPipelineList(crmView);
    board = loadedBoard;
    hub = loadedHub;

    // Investable Score — same composite the Qualify stage shows, so the gate here
    // matches what the founder saw there. Readiness-weighted, plus profile and gates.
    const readiness = journeyState.conditions.readinessScore ?? 0;
    const profilePercent = buildProfileCompletion(company).percent;
    investableScore = Math.round(
      Math.min(
        100,
        0.6 * readiness +
          0.3 * profilePercent +
          (journeyState.conditions.onboardingComplete ? 5 : 0) +
          (journeyState.conditions.requiredDocsUploaded ? 5 : 0),
      ),
    );

    // Founder-safe Partner view for each shown investor. Reads cached partner-score
    // snapshots in a single query (refreshed by the daily orchestration cron), with
    // a live-compute fallback for any investor not yet snapshotted. Service role: a
    // founder can't read other investors' data directly.
    const scores = await loadPartnerScoresBatch(
      serviceSupabase,
      pipelineList.map((row) => row.investorId),
    );
    for (const row of pipelineList) {
      const score = scores.get(row.investorId);
      if (score) partnerViews.set(row.investorId, founderFacingPartnerView(score));
    }
  }

  // Founder-automatic outreach: once the Investable Score clears the threshold,
  // ensure the company's outreach campaign exists and is approved so the weekly
  // send pass shares the Founder Preview with matched investors. Idempotent and
  // non-blocking — the Deploy view must never fail on outreach setup. (Real email
  // dispatch is still gated by INVESTOR_OUTREACH_LIVE.)
  if (company && investableScore >= OUTREACH_THRESHOLD) {
    try {
      await ensureFounderAutomatedOutreach(company.id, profile.id);
    } catch {
      // Non-fatal.
    }
  }

  const followUpsNeeded = crmView?.summary.followUpsNeeded ?? 0;
  const pledgedCount = crmView?.sections.pledged.length ?? 0;
  const interestedCount = crmView?.summary.totalInterestedInvestors ?? 0;
  const introRequests = crmView?.summary.introRequests ?? 0;

  // Analytics: automated (Private Market reach) vs. manual (CRM funnel), with
  // AI insight cards derived from the real numbers.
  const analytics: DeployAnalytics = {
    automated: [
      { label: "Universe", value: board?.summary.investorUniverse ?? 0 },
      { label: "Surfaced", value: board?.rows.length ?? 0 },
      { label: "Reached out", value: board?.summary.reachedOut ?? 0 },
      { label: "Strong fit", value: board?.summary.strongCount ?? 0 },
    ],
    manual: [
      { label: "Interested", value: interestedCount },
      { label: "Intro req.", value: introRequests },
      { label: "Follow-up", value: followUpsNeeded },
      { label: "Pledged", value: pledgedCount },
    ],
    insights: buildDeployInsights({
      investableScore,
      followUpsNeeded,
      interestedCount,
      pledgedCount,
      reachedOut: board?.summary.reachedOut ?? 0,
      strongCount: board?.summary.strongCount ?? 0,
      published: company?.is_published ?? false,
    }),
  };

  // ---- Step 1 · Public Profile (preview snapshot + publish state + links) ----
  const isPublished = company?.is_published ?? false;
  const publicHref = company?.slug ? `/f/${company.slug}` : null;
  const profileSnapshot: { label: string; value: string }[] = company
    ? [
        { label: "Company", value: company.company_name ?? "—" },
        { label: "Industry", value: company.industry ?? "—" },
        {
          label: "Raise",
          value: company.funding_amount ? formatPledgeTotal(company.funding_amount, "USD") : "—",
        },
        { label: "Revenue stage", value: company.revenue_stage ?? "—" },
      ]
    : [];

  const publicProfileNode = (
    <>
      <div
        className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
          isPublished ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
        }`}
      >
        <div>
          <p className={`text-sm font-semibold ${isPublished ? "text-emerald-900" : "text-amber-900"}`}>
            {isPublished ? "Published — investors can see your one-pager" : "Not published yet"}
          </p>
          <p className={`text-xs ${isPublished ? "text-emerald-700" : "text-amber-700"}`}>
            {isPublished
              ? "This is what appears when an investor opens your profile."
              : "Publish from your profile settings once the preview looks right — investors can't see it until you do."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/founder/preview"
            className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            View public page
          </Link>
          <Link
            href="/founder/settings"
            className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            Edit profile ↗
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-slate-900">Profile snapshot</p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {profileSnapshot.map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-slate-400">{item.label}</dt>
              <dd className="truncate text-sm font-medium text-slate-800">{item.value}</dd>
            </div>
          ))}
        </dl>
        {company?.business_description ? (
          <p className="mt-3 line-clamp-3 text-sm text-slate-600">{company.business_description}</p>
        ) : null}
        <p className="mt-3 text-xs text-slate-400">
          Editing happens in one place — your profile settings — so the preview, your public page, and investor
          matching always stay in sync.
        </p>
        {publicHref && isPublished ? (
          <a
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Open live link {publicHref} ↗
          </a>
        ) : null}
      </div>
    </>
  );

  // ---- Step 2 · Outreach → Automated (Private Market embed, relocated here) ----
  const automatedNode =
    company && board ? (
      <>
        <FounderPrivateMarketTicker rows={board.rows} />
        <FounderPrivateMarketSummaryCards summary={board.summary} rankedCount={board.rows.length} />
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          <span aria-hidden="true">ⓘ</span>
          <span>
            <b className="text-slate-800">Information display only.</b> Match scores reflect rules-based fit to your
            company profile. Contact details are hidden and introductions run through iCapOS. Nothing here is investment
            advice, a solicitation, or a guarantee of funding.
          </span>
        </div>
        <FounderPrivateMarketBoard rows={board.rows} />
      </>
    ) : (
      <EmptyState
        title="Link a company to see automated matches"
        description="Complete your company setup so investors can be ranked to your raise here."
        secondaryActionLabel="Edit profile"
        secondaryActionHref="/founder/settings"
      />
    );

  // ---- Step 2 · Outreach → Manual (Investor CRM + Outreach & planning tools + pipeline) ----
  const manualNode = (
    <>
      {company && hub ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <h2 className="text-sm font-medium text-slate-900">Investor CRM</h2>
            <p className="text-xs text-slate-500">
              Add investors, import a CSV, and run your private outreach — all in one place.
            </p>
          </div>
          <FounderInvestorHubPanels
            companyName={company.company_name}
            contacts={hub.contacts}
            targets={hub.targets}
            campaigns={hub.campaigns}
            readiness={hub.readiness}
            platformMatches={hub.platformMatches}
            followUpCount={hub.followUpCount}
            socialDrafts={hub.socialDrafts}
            socialReadiness={hub.socialReadiness}
            companySnapshot={{
              companyName: company.company_name,
              industry: company.industry ?? null,
              businessDescription: company.business_description ?? null,
              revenueStage: company.revenue_stage ?? null,
              fundingAmount: company.funding_amount ? Number(company.funding_amount) : null,
              geography: [company.state, company.country].filter(Boolean).join(", ") || null,
              founderGoals: company.founder_goals ?? null,
            }}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MANUAL_TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <span className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">{tool.label}</span>
              <span className="text-slate-400">→</span>
            </span>
            <span className="mt-1 text-xs text-slate-500">{tool.blurb}</span>
          </Link>
        ))}
      </div>

      {followUpsNeeded > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">
            {followUpsNeeded} investor{followUpsNeeded === 1 ? "" : "s"} need a follow-up — pick targets from your
            matches and keep the raise moving.
          </p>
          <Link
            href="/founder/investors"
            className="shrink-0 rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-500"
          >
            Review follow-ups →
          </Link>
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900">{t("investor_pipeline_2")}</h2>
          <Link href="/founder/investors" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            Open full investor CRM →
          </Link>
        </div>
        {pipelineList.length === 0 ? (
          <EmptyState
            title={t("no_investor_activity_yet")}
            description={t("as_investors_express_interest_or_request_intro")}
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
                    {partnerViews.has(row.investorId) ? (
                      <div className="mt-1.5">
                        <FounderFacingInvestorTier view={partnerViews.get(row.investorId)!} showFacts={false} />
                      </div>
                    ) : null}
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
    </>
  );

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
            eyebrow={t("stage_3_deploy")}
            title={t("run_your_raise")}
            description={t("track_your_investor_pipeline_keep_momentum_wit")}
          />

          <div className="mt-4">
            <DeployWorkflow
              companyName={company?.company_name ?? "Your company"}
              investableScore={investableScore}
              outreachThreshold={OUTREACH_THRESHOLD}
              publicProfile={publicProfileNode}
              automated={automatedNode}
              manual={manualNode}
              analytics={analytics}
            />
          </div>
        </FounderFeatureGate>
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
