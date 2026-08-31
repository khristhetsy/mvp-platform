import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getFounderMatchQueue, countViewersForFounder } from "@/lib/matching/queue";
import { loadFounderMatchingCenter } from "@/lib/matching/founder-matching-center";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { founderEntitlements } from "@/lib/subscriptions/entitlements";
import { FounderMatchQueue } from "@/components/matching/FounderMatchQueue";
import { MatchStatusStepper } from "@/components/matching/MatchStatusStepper";
import { MatchingCenterList, type MatchCenterCard } from "@/components/matching/MatchingCenterList";
import { DealCompanyEmptyState } from "@/components/founder/DealCompanyEmptyState";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadPartnerScoresBatch } from "@/lib/investor-rating/snapshot";
import { TIER_LABELS, type PartnerScore } from "@/lib/investor-rating/types";

export const dynamic = "force-dynamic";

function titleCase(s: string): string {
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function FounderMatchesPage() {
  const profile = await requireRole(["founder"]);
  // Matching is a founder-raise surface; a Deal Company (null company) shows none
  // of it — including the profile-scoped inbound queue and viewer count.
  const { company } = await getActiveCompanyForUser(profile);

  if (!company) {
    return (
      <FounderAppShell
        profileName={profile.full_name ?? profile.email ?? "Founder"}
        profileSubtitle="No active raise"
      >
        <PageHeader
          eyebrow="Matching"
          title="Investor matches"
          description="Search the investor network — request an introduction or add a connected investor to follow-up. Investors who've expressed interest in you appear below."
        />
        <DealCompanyEmptyState />
      </FounderAppShell>
    );
  }

  const queue = company ? await getFounderMatchQueue(profile.id) : null;
  const items = queue?.items ?? [];
  const companyIds = queue?.companyIds ?? [];
  const viewers = company ? await countViewersForFounder(companyIds) : 0;
  const data = company ? await loadFounderMatchingCenter(company) : { cards: [], total: 0, strong: 0 };
  const plan = await getUserPlan(profile.id);
  // Free sees matches (count · sector · fit tier) but not identities or actions.
  const reveal = founderEntitlements(plan).revealInvestorIdentities;

  // Investor Rating = the Partner Score, keyed on the member investor's profile id
  // (c.ref). Prospects (Form D / imported) aren't platform members, so they have
  // no partner score and stay "New".
  const memberRefs = data.cards.filter((c) => !c.isProspect && c.ref).map((c) => c.ref as string);
  const partnerScores: Map<string, PartnerScore> = memberRefs.length
    ? await loadPartnerScoresBatch(createServiceRoleClient(), memberRefs)
    : new Map<string, PartnerScore>();

  const cards: MatchCenterCard[] = data.cards.map((c) => {
    const ps = !c.isProspect && c.ref ? partnerScores.get(c.ref) : undefined;
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
        investorScore: ps?.score ?? null,
        scoreTier: ps ? TIER_LABELS[ps.tier] : null,
        scoreRated: ps?.status === "rated",
      },
    };
  });

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle="Investor matches"
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Matching"
          title="Investor matches"
          description="Search the investor network — request an introduction or add a connected investor to follow-up. Investors who've expressed interest in you appear below."
        />

        {/* Investor search — the full named directory with per-investor actions. */}
        <MatchingCenterList
          cards={cards}
          introEndpoint="/api/founder/matching/intro"
          followUpEndpoint="/api/founder/matching/follow-up"
          draftEndpoint="/api/founder/matching/draft-note"
          emptyText="No investor matches yet. Complete your profile and readiness materials to surface matched investors."
        />

        {/* Inbound pipeline — investors who've expressed interest → approve. */}
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-[var(--navy,#0c2340)]">Interested investors</h2>
          <MatchStatusStepper />

          <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-[#E3E8F2] bg-white px-4 py-2.5 text-sm">
            <span className="text-[#5A6782]">Investors who&apos;ve viewed your profile</span>
            <span className="rounded-full bg-[#EAF1FD] px-2.5 py-0.5 font-bold text-[#1A6CE4]">{viewers}</span>
          </div>

          <FounderMatchQueue items={items} />
        </div>
      </WorkspacePageContainer>
    </FounderAppShell>
  );
}
