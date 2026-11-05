import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { requireRole } from "@/lib/supabase/auth";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";
import { CompanySettingsForm } from "./settings-form";
import { VocabularyProvider } from "@/lib/vocabulary/provider";
import { loadVocabularies } from "@/lib/vocabulary/store";
import { loadSurfaceDisplay } from "@/lib/profile-fields/display-store";
import { SettingsSidebarNav } from "./SettingsSidebarNav";
import { PublicProfileEditor } from "@/components/founder/PublicProfileEditor";
import { OnePagerPublishCard } from "@/components/founder/OnePagerPublishCard";
import { FounderProfileTabs } from "@/components/founder/FounderProfileTabs";
import { TipsPreferenceToggle } from "@/components/tips/TipsPreferenceToggle";
import { SignatureSettings } from "@/components/email/SignatureSettings";
import { AccountSection } from "@/components/account/AccountSection";

export const dynamic = "force-dynamic";

export default async function FounderSettingsPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const { company } = await getActiveCompanyForUser(profile);
  // Option lists edited on Admin, Profile and fields.
  const vocabularies = await loadVocabularies();
  // Shown and Required per field, from Admin, Profile and fields.
  const display = await loadSurfaceDisplay("founder_settings");

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <PageHeader
        eyebrow={t("settings")}
        title={t("company_profile")}
        description={t("edit_your_public_listing_company_details_and_b")}
        actions={
          <Link
            href="/founder/preview"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 600, color: "#2E78F5",
              background: "#EEEDFE", borderRadius: 10,
              padding: "8px 16px", textDecoration: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" stroke="#2E78F5" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" stroke="#2E78F5" strokeWidth="2" />
            </svg>
            Preview as investor
          </Link>
        }
      />

      <SettingsSidebarNav active="company" />

      <FounderProfileTabs
        profileTab={
          <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">{t("company_profile")}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{t("edit_your_public_listing_and_company_details")}</p>
              </div>
              <div className="p-6">
                {company ? <VocabularyProvider value={vocabularies}><CompanySettingsForm company={company} display={display} /></VocabularyProvider> : null}
                {company ? (
                  <div className="mt-8">
                    <CollaborationDiscussionPanel
                      entityType="company"
                      entityId={company.id}
                      title={t("company_discussion")}
                    />
                  </div>
                ) : null}
              </div>
            </section>

            <section className="mt-6 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">{t("preferences")}</h2>
              <TipsPreferenceToggle />
              <SignatureSettings />
            </section>

            <AccountSection companyName={company?.company_name ?? null} />
          </>
        }
        onePagerTab={
          <div className="space-y-4">
            {company && (
              <OnePagerPublishCard
                initialIsPublished={company.is_published ?? false}
                initialSlug={company.slug ?? null}
                companyName={company.company_name}
              />
            )}
            {company ? (
              <PublicProfileEditor
                companyId={company.id}
                initial={{
                  company_name: company.company_name,
                  website: company.website ?? null,
                  country: company.country ?? null,
                  state: company.state ?? null,
                  funding_amount: company.funding_amount != null ? String(company.funding_amount) : null,
                  business_description: company.business_description ?? null,
                  key_highlights: (company as unknown as Record<string, string | null>).key_highlights ?? null,
                  team_summary: company.team_summary ?? null,
                  management_team: (company as unknown as Record<string, string | null>).management_team ?? null,
                  use_of_funds: company.use_of_funds ?? null,
                  founder_goals: company.founder_goals ?? null,
                }}
                lastSavedAt={(company as unknown as { updated_at?: string | null }).updated_at ?? null}
              />
            ) : null}
          </div>
        }
      />
    </FounderAppShell>
  );
}
