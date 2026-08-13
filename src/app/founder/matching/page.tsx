import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { loadFounderMatchingCenter } from "@/lib/matching/founder-matching-center";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { MatchingCenterList, type MatchCenterCard } from "@/components/matching/MatchingCenterList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matching Center" };

function titleCase(s: string): string {
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function FounderMatchingPage() {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);

  // Only surface investor matches once the company is admin-approved or published.
  const eligible = Boolean(company && (company.review_status === "approved" || company.is_published));

  if (!eligible) {
    return (
      <FounderAppShell
        profileName={profile.full_name ?? profile.email ?? "Founder"}
        profileSubtitle={company?.company_name ?? "Your company"}
      >
        <WorkspacePageContainer>
          <PageHeader
            eyebrow="Matching"
            title="Matching Center"
            description="Ranked investor matches unlock once your company is approved or published."
          />
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-900">Not available yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Complete your readiness materials and get admin approval (or publish to the marketplace) to see investor
              contacts matched to your company.
            </p>
          </div>
        </WorkspacePageContainer>
      </FounderAppShell>
    );
  }

  const [data, plan] = await Promise.all([loadFounderMatchingCenter(company!), getUserPlan(profile.id)]);
  // Free sees that matches exist (count · sector · fit tier) but NOT who — identities
  // and distribution actions unlock on Basic and up.
  const reveal = founderEntitlements(plan).revealInvestorIdentities;

  const cards: MatchCenterCard[] = data.cards.map((c) => {
    const label = c.investorType ? `${titleCase(c.investorType)}` : "Investor";
    const displayName = reveal ? c.name : "Matched investor";
    const subtitle = reveal
      ? [c.firm, label, c.checkBand ? `Check ${c.checkBand}` : null].filter(Boolean).join(" · ") || null
      : [label, c.checkBand ? `Check ${c.checkBand}` : null].filter(Boolean).join(" · ") || null;
    return {
      matchScore: c.matchScore,
      tag: c.isProspect ? "Prospect" : "Member",
      title: displayName,
      subtitle,
      reasons: c.reasons,
      introRef: reveal ? c.ref : undefined,
      connected: reveal ? c.connected : false,
      followUp: reveal ? { name: c.name, firm: c.firm, investorType: c.investorType } : undefined,
      detail: {
        name: displayName,
        band: c.matchScore >= 70 ? "high" : c.matchScore >= 45 ? "mid" : "low",
        matchScore: c.matchScore,
        label,
        fitSector: c.fitSector,
        fitStage: c.fitStage,
        fitCheck: c.fitCheck,
        fitGeo: c.fitGeo,
        sectors: c.sectors,
        capitalTypes: c.capitalTypes,
        stages: c.stages,
        geographies: c.geographies,
        checkSize: c.checkBand ?? "—",
        pledgeCount: 0,
        indicated: 0,
        investorScore: null,
        scoreTier: null,
        scoreRated: false,
      },
    };
  });

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Matching"
          title="Matching Center"
          description="Investor contacts across the iCapOS network ranked by fit with your company — including members and prospects in our pipeline. Identities stay private until an introduction is made."
        />
        <div className="mt-4 flex gap-4">
          <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm">
            <span className="font-semibold text-slate-900">{data.total}</span>{" "}
            <span className="text-slate-500">matched contacts</span>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm">
            <span className="font-semibold text-emerald-700">{data.strong}</span>{" "}
            <span className="text-slate-500">strong (70%+)</span>
          </div>
        </div>
        {!reveal && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Free plan:</span> you can see that matches exist — count,
            sector, and fit tier — but investor identities and outreach unlock on{" "}
            <a href="/billing" className="font-medium text-indigo-700 underline">
              Basic
            </a>
            .
          </div>
        )}
        <div className="mt-6">
          <MatchingCenterList
            cards={cards}
            introEndpoint="/api/founder/matching/intro"
            followUpEndpoint="/api/founder/matching/follow-up"
            draftEndpoint="/api/founder/matching/draft-note"
            emptyText="No investor matches yet. Complete your profile and readiness materials to surface matched investors."
          />
        </div>
        <p className="mt-6 text-xs text-slate-400">
          Fit scores are operational indicators, not investment advice. Introductions are brokered by the iCapOS team.
        </p>
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
