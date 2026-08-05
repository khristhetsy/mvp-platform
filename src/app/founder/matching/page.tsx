import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { loadFounderMatchingCenter } from "@/lib/matching/founder-matching-center";
import { MatchingCenterList, type MatchCenterCard } from "@/components/matching/MatchingCenterList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matching Center" };

function titleCase(s: string): string {
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function FounderMatchingPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const data = company ? await loadFounderMatchingCenter(company) : { cards: [], total: 0, strong: 0 };

  const cards: MatchCenterCard[] = data.cards.map((c) => ({
    matchScore: c.matchScore,
    tag: c.isProspect ? "Prospect" : "Member",
    title: c.investorType ? `${titleCase(c.investorType)} investor` : "Investor",
    subtitle: c.checkBand ? `Typical check ${c.checkBand}` : null,
    reasons: c.reasons,
  }));

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
        <div className="mt-6">
          <MatchingCenterList
            cards={cards}
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
