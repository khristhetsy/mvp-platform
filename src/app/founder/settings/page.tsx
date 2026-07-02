import Link from "next/link";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { requireRole } from "@/lib/supabase/auth";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";
import { CompanySettingsForm } from "./settings-form";
import { SettingsSidebarNav } from "./SettingsSidebarNav";
import { OnePagerPublishCard } from "@/components/founder/OnePagerPublishCard";
import { TipsPreferenceToggle } from "@/components/tips/TipsPreferenceToggle";
import { SignatureSettings } from "@/components/email/SignatureSettings";

export const dynamic = "force-dynamic";

export default async function FounderSettingsPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);

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

      {company && (
        <OnePagerPublishCard
          initialIsPublished={company.is_published ?? false}
          initialSlug={company.slug ?? null}
          companyName={company.company_name}
        />
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">{t("company_profile")}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t("edit_your_public_listing_and_company_details")}</p>
        </div>
        <div className="p-6">
          <CompanySettingsForm company={company} />
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
    </FounderAppShell>
  );
}
