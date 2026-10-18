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
import { InvestorDirectoryTabs } from "@/components/founder/investor-directory/InvestorDirectoryTabs";
import { InvestorDirectoryGuide } from "@/components/founder/investor-directory/InvestorDirectoryGuide";
import { founderDirectoryEnabled, heldDirectoryIds, loadPlanAllowances, loadSettings } from "@/lib/investor-directory/db";
import { getServerLocale } from "@/lib/i18n/locale";
import { UpdateNoteBanner, UpdateNoteShowLink } from "@/components/founder/investor-directory/DirectoryUpdateNote";

export const dynamic = "force-dynamic";

/** Stage 3 › Investor directory: search public investor data and import it into Manual outreach. */
export default async function FounderInvestorDirectoryPage() {
  const profile = await requireRole(["founder"]);
  const { company } = await getActiveCompanyForUser(profile);
  const locale = await getServerLocale();
  // The guide stays open until the first directory import; its limits come from the live plan table.
  const [held, allowances, settings, enabled] = await Promise.all([
    company ? heldDirectoryIds(company.id) : Promise.resolve(new Set<string>()),
    loadPlanAllowances(),
    loadSettings(),
    founderDirectoryEnabled(),
  ]);
  // Admin › Investor Directory › Access decides which tabs founders see.
  const tabs = {
    directory: settings.tab_directory,
    formd: settings.tab_formd,
    linkedin: settings.tab_linkedin,
    csv: settings.tab_csv,
  };
  const holds = (planType: string) => allowances.find((a) => a.plan_type === planType)?.contacts ?? 0;
  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"} profileSubtitle={company?.company_name ?? "Your company"}>
      <FounderJourneyGate minStage="deploy">
        <FounderFeatureGate featureKey="investor_access">
          <div className="mb-4">
            <Link href="/founder/deploy?step=outreach&mode=manual" className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700">← Manual outreach</Link>
          </div>
          <PageHeader
            title="Investor directory"
            description="Public investor data, not the iCFO Capital investor network. Select investors and import them into your Manual outreach."
          />
          {!enabled ? (
            <EmptyState
              title="Investor directory isn't available right now"
              description="Your contacts and Manual outreach still work. Contact iCFO Capital if you need the directory."
              secondaryActionLabel="Go to Manual outreach"
              secondaryActionHref="/founder/deploy?step=outreach&mode=manual"
            />
          ) : company ? (
            <VocabularyProvider value={await loadVocabularies()}>
              <InvestorDirectoryGuide
                key={held.size > 0 ? "used" : "new"}
                defaultOpen={held.size === 0}
                limits={{ basic: holds("founder_basic"), professional: holds("founder_professional"), premium: holds("founder_premium") }}
              />
              <UpdateNoteShowLink locale={locale} />
              <UpdateNoteBanner locale={locale} />
              <InvestorDirectoryTabs enabled={tabs} />
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
