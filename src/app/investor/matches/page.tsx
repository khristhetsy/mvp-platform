import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkspacePageContainer } from "@/components/ui/workspace-layout";
import { requireRole } from "@/lib/supabase/auth";
import { getAnonymizedMatchCards } from "@/lib/matching/anonymized-cards";
import { logInvestorMatchCardViews } from "@/lib/matching/queue";
import { InvestorMatchList } from "@/components/matching/InvestorMatchList";

export const dynamic = "force-dynamic";

export default async function InvestorMatchesPage() {
  const profile = await requireRole(["investor"]);
  const cards = await getAnonymizedMatchCards(profile.id);
  // Audit: log a match_card view for each pre-introduction match (company_id
  // stays server-side; never sent to the client).
  await logInvestorMatchCardViews(profile.id);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle="Investor workspace"
      profileEmail={profile.email ?? undefined}
    >
      <WorkspacePageContainer>
        <PageHeader
          eyebrow="Matching"
          title="Your matches"
          description="Fit-scored founders, anonymized until both sides consent to an introduction."
        />
        <InvestorMatchList cards={cards} />
      </WorkspacePageContainer>
    </AppShell>
  );
}
