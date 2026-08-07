import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { getFounderMatchQueue, countViewersForFounder } from "@/lib/matching/queue";
import { loadFounderMatchingCenter } from "@/lib/matching/founder-matching-center";
import { FounderMatchQueue } from "@/components/matching/FounderMatchQueue";
import { MatchStatusStepper } from "@/components/matching/MatchStatusStepper";
import { MatchingCenterList, type MatchCenterCard } from "@/components/matching/MatchingCenterList";

export const dynamic = "force-dynamic";

function titleCase(s: string): string {
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function FounderMatchesPage() {
  const profile = await requireRole(["founder"]);
  const [{ items, companyIds }, company] = await Promise.all([
    getFounderMatchQueue(profile.id),
    ensureFounderCompanyForUser(profile),
  ]);
  const viewers = await countViewersForFounder(companyIds);
  const data = company ? await loadFounderMatchingCenter(company) : { cards: [], total: 0, strong: 0 };

  const cards: MatchCenterCard[] = data.cards.map((c) => {
    const label = c.investorType ? `${titleCase(c.investorType)}` : "Investor";
    const subtitle = [c.firm, label, c.checkBand ? `Check ${c.checkBand}` : null].filter(Boolean).join(" · ") || null;
    return {
      matchScore: c.matchScore,
      tag: c.isProspect ? "Prospect" : "Member",
      title: c.name,
      subtitle,
      reasons: c.reasons,
      introRef: c.ref,
      connected: c.connected,
      followUp: { name: c.name, firm: c.firm, investorType: c.investorType },
      detail: {
        name: c.name,
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
