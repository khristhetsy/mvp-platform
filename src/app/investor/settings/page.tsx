import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { BetaFeedbackForm } from "@/components/beta/BetaFeedbackForm";
import { GoogleCalendarConnectionCard } from "@/components/GoogleCalendarConnectionCard";
import { InvestorOnboardingWizard } from "@/components/InvestorOnboardingWizard";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { ensureInvestorProfileForUser } from "@/lib/investor/profile";
import { InvestorProfileCompletenessCard } from "@/components/investor/InvestorProfileCompletenessCard";
import { InvestorSettingsNav } from "./InvestorSettingsNav";

export const dynamic = "force-dynamic";

type Tab = "profile" | "integrations" | "feedback";

export default async function InvestorSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { profile, supabase, investorId } = await requireInvestorWorkspaceSession();
  const t = await getTranslations("appPages");
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === "integrations" || rawTab === "feedback" ? rawTab : "profile";

  const [investorProfile, googleStatus] = await Promise.all([
    ensureInvestorProfileForUser(profile.id),
    getGoogleConnectionStatus(supabase, investorId),
  ]);

  return (
    <AppShell
      role="INVESTOR"
      workspace="investor"
      profileName={profile.full_name ?? profile.email ?? "Investor"}
      profileSubtitle={t("investor_account")}
    >
      <PageHeader
        eyebrow={t("investor_workspace_2")}
        title={t("settings")}
        description={t("manage_your_investor_profile_integrations_and")}
      />

      <InvestorSettingsNav active={tab} />

      {tab === "profile" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">{t("investor_profile")}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Update your investment thesis, sectors, check size, and preferences.
              Changes are saved to your profile immediately.
            </p>
          </div>
          <div className="p-6">
            <InvestorProfileCompletenessCard profile={investorProfile} />
            <InvestorOnboardingWizard
              investorProfile={investorProfile}
              profileName={profile.full_name ?? profile.email ?? "Investor"}
            />
          </div>
        </section>
      )}

      {tab === "integrations" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">{t("integrations")}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t("connect_third_party_tools_to_your_investor_wor")}</p>
          </div>
          <div className="p-6">
            <Suspense fallback={<p className="text-sm text-slate-500">{t("loading_2")}</p>}>
              <GoogleCalendarConnectionCard status={googleStatus} returnPath="/investor/settings?tab=integrations" />
            </Suspense>
          </div>
        </section>
      )}

      {tab === "feedback" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">{t("feedback")}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t("help_us_improve_icapos_for_investors")}</p>
          </div>
          <div className="p-6">
            <BetaFeedbackForm />
          </div>
        </section>
      )}
    </AppShell>
  );
}
