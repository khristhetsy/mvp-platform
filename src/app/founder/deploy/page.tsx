import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { buildFounderInvestorCrmView } from "@/lib/data/investor-crm";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { loadFounderInvestorBoard } from "@/lib/founder/private-market";
import { buildProfileCompletion } from "@/lib/data/founder-readiness";
import { evaluateFounderJourney } from "@/lib/founder-journey/evaluate";
import { loadFounderInvestorHub } from "@/lib/founder-crm/load-founder-investor-hub";
import { ManualOutreachBuilder } from "@/components/founder/ManualOutreachBuilder";
import { ensureFounderAutomatedOutreach } from "@/lib/outreach/investor-outreach";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { FounderPrivateMarketBoard } from "@/components/founder/FounderPrivateMarketBoard";
import { FounderPrivateMarketSummaryCards } from "@/components/founder/FounderPrivateMarketSummaryCards";
import { FounderPrivateMarketTicker } from "@/components/founder/FounderPrivateMarketTicker";
import { DeployWorkflow, type DeployAnalytics, type DeployInsight } from "@/components/founder/DeployWorkflow";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

const OUTREACH_THRESHOLD = 70;

/** Turn the real pipeline numbers into expandable AI insight cards for the Analytics step. */
function buildDeployInsights(input: {
  investableScore: number;
  followUpsNeeded: number;
  reachedOut: number;
  strongCount: number;
  published: boolean;
}): DeployInsight[] {
  const insights: DeployInsight[] = [];

  if (input.investableScore < OUTREACH_THRESHOLD) {
    insights.push({
      id: "score-gate",
      title: `CRR is ${input.investableScore} — automation is paused`,
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
      summary: `Your CRR of ${input.investableScore} clears the ${OUTREACH_THRESHOLD} threshold.`,
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
  const { company } = await getActiveCompanyForUser(profile);

  let crmView: ReturnType<typeof buildFounderInvestorCrmView> | null = null;
  let board: Awaited<ReturnType<typeof loadFounderInvestorBoard>> | null = null;
  let hub: Awaited<ReturnType<typeof loadFounderInvestorHub>> | null = null;
  let investableScore = 0;

  if (company) {
    const supabase = await createServerSupabaseClient();
    const serviceSupabase = createServiceRoleClient();
    const pledgeCompanyId = await getFounderPledgeCompanyId(serviceSupabase, profile.id, company.id);
    // Board is loaded AFTER outreach enrollment below, so newly-queued recipients
    // show on first render (not just on refresh).
    const [activity, pledgeSummary, journeyState, loadedHub] = await Promise.all([
      listFounderInvestorActivity(supabase, company.id),
      getCompanyPledgeSummary(serviceSupabase, pledgeCompanyId),
      evaluateFounderJourney(supabase, profile.id),
      loadFounderInvestorHub(company, profile.id),
    ]);
    crmView = buildFounderInvestorCrmView(activity, pledgeSummary);
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

    // Founder-automatic outreach: once the Investable Score clears the threshold,
    // ensure the company's outreach campaign exists and is approved. Runs BEFORE
    // the board load so queued recipients render immediately. Non-fatal; real
    // email dispatch is still gated by the automation toggle + published one-pager.
    if (investableScore >= OUTREACH_THRESHOLD) {
      try {
        await ensureFounderAutomatedOutreach(company.id, profile.id);
      } catch {
        // Non-fatal.
      }
    }

    board = await loadFounderInvestorBoard(company);
  }

  const followUpsNeeded = crmView?.summary.followUpsNeeded ?? 0;
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
    ],
    insights: buildDeployInsights({
      investableScore,
      followUpsNeeded,
      reachedOut: board?.summary.reachedOut ?? 0,
      strongCount: board?.summary.strongCount ?? 0,
      published: company?.is_published ?? false,
    }),
  };

  // ---- Step 1 · Public Profile (embedded live preview + publish state + links) ----
  const isPublished = company?.is_published ?? false;
  const publicHref = company?.slug ? `/f/${company.slug}` : null;

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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-xs font-medium text-slate-500">Live preview — exactly what investors see</span>
          {publicHref && isPublished ? (
            <a
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Open live link ↗
            </a>
          ) : null}
        </div>
        <iframe
          src="/founder/preview?embed=1"
          title="Investor one-pager preview"
          className="h-[640px] w-full border-0"
        />
      </div>
      <p className="text-xs text-slate-400">
        Editing happens in one place — your profile settings — so this preview, your public page, and investor
        matching always stay in sync.
      </p>
    </>
  );

  // ---- Step 2 · Outreach → Automated (Private Market embed, relocated here) ----
  const automatedNode =
    company && board ? (
      <>
        <FounderPrivateMarketTicker rows={board.rows} />
        <FounderPrivateMarketSummaryCards summary={board.summary} rankedCount={board.rows.length} />
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

  // ---- Step 2 · Outreach → Manual (Investor outreach wizard only) ----
  const manualNode =
    company && hub ? (
      <ManualOutreachBuilder
        contacts={hub.contacts.map((c) => ({
          id: c.id,
          name: c.investor_name,
          email: c.email,
          detail: [c.firm_name, c.investor_type].filter(Boolean).join(" · ") || c.email,
        }))}
      />
    ) : (
      <EmptyState
        title="Link a company to run outreach"
        description="Complete your company setup, then build and send your investor outreach here."
        secondaryActionLabel="Edit profile"
        secondaryActionHref="/founder/settings"
      />
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
