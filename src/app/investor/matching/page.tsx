import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { getAnonymizedMatchCards } from "@/lib/matching/anonymized-cards";
import { MatchingCenterList, type MatchCenterCard } from "@/components/matching/MatchingCenterList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matching Center" };

function titleCase(s: string): string {
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function InvestorMatchingPage() {
  const profile = await requireRole(["investor"]);
  const raw = await getAnonymizedMatchCards(profile.id);

  const cards: MatchCenterCard[] = raw.map((c) => {
    const title = [c.industry ? titleCase(c.industry) : "Company", c.stage ? titleCase(c.stage) : null]
      .filter(Boolean)
      .join(" · ");
    const subtitle = [c.raiseBand, c.region].filter(Boolean).join(" · ") || null;
    const reasons = [c.readinessBand].filter(Boolean) as string[];
    return { matchScore: c.matchScore, tag: c.readinessBand, title, subtitle, reasons };
  });

  const strong = cards.filter((c) => c.matchScore >= 70).length;

  return (
    <AppShell role="INVESTOR" workspace="investor" profileName={profile.full_name ?? profile.email ?? "Investor"} profileSubtitle="Matching Center">
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Matching"
          title="Matching Center"
          description="Founder contacts across the iCapOS network ranked by fit with your mandate. Company identities stay anonymized until both sides consent to an introduction."
        />
        <div className="mt-4 flex gap-4">
          <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm">
            <span className="font-semibold text-slate-900">{cards.length}</span>{" "}
            <span className="text-slate-500">matched founders</span>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm">
            <span className="font-semibold text-emerald-700">{strong}</span>{" "}
            <span className="text-slate-500">strong (70%+)</span>
          </div>
        </div>
        <div className="mt-6">
          <MatchingCenterList
            cards={cards}
            emptyText="No founder matches yet. Complete your investor profile and mandate to surface matched companies."
          />
        </div>
        <p className="mt-6 text-xs text-slate-400">
          Fit scores are operational indicators, not investment advice.
        </p>
      </WorkspacePageContainer>
    </AppShell>
  );
}
