import Link from "next/link";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderFeatureGate } from "@/components/FounderFeatureGate";
import { FounderJourneyGate } from "@/components/founder/FounderJourneyGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { VocabularyProvider } from "@/lib/vocabulary/provider";
import { loadVocabularies } from "@/lib/vocabulary/store";
import { InvestorDirectoryClient } from "@/components/founder/investor-directory/InvestorDirectoryClient";

export const dynamic = "force-dynamic";

/** Stage 3 › Investor directory: search public investor data and import it into Manual outreach. */
export default async function FounderInvestorDirectoryPage() {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);
  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company?.company_name ?? "Your company"}>
      <FounderJourneyGate minStage="deploy">
        <FounderFeatureGate featureKey="investor_access">
          <div className="mb-4">
            <Link href="/founder/deploy?step=outreach&mode=manual" className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700">← Manual outreach</Link>
          </div>
          <PageHeader
            title="Investor directory"
            description="Public investor data, outside the iCFO network. Select investors and import them into your Manual outreach."
          />
          {company ? (
            <VocabularyProvider value={await loadVocabularies()}>
              <InvestorDirectoryClient />
            </VocabularyProvider>
          ) : (
            <EmptyState
              title="Link a company to use the directory"
              description="Complete your company setup, then import investors into your outreach here."
              secondaryActionLabel="Edit profile"
              secondaryActionHref="/founder/settings"
            />
          )}
        </FounderFeatureGate>
      </FounderJourneyGate>
    </FounderAppShell>
  );
}
