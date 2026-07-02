import { Suspense } from "react";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { GoogleCalendarConnectionCard } from "@/components/GoogleCalendarConnectionCard";
import { DraftEmailPanel } from "@/components/email/DraftEmailPanel";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { SettingsSidebarNav } from "../SettingsSidebarNav";

export const dynamic = "force-dynamic";

export default async function FounderSettingsIntegrationsPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  const supabase = await createServerSupabaseClient();
  const googleStatus = await getGoogleConnectionStatus(supabase, profile.id);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <PageHeader
        eyebrow={t("settings")}
        title={t("integrations")}
        description={t("connect_external_accounts_and_tools_to_your_wo")}
      />

      <SettingsSidebarNav active="integrations" />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">{t("integrations")}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t("connected_accounts_and_tools")}</p>
        </div>
        <div className="space-y-6 p-6">
          <DraftEmailPanel
            role="founder"
            entityType={company ? "company" : undefined}
            entityId={company?.id}
            defaultTemplate="founder_investor_intro_followup"
            googleConnected={googleStatus.connected}
          />
          <Suspense fallback={<p className="text-sm text-slate-500">{t("loading_google_connection")}</p>}>
            <GoogleCalendarConnectionCard status={googleStatus} returnPath="/founder/settings/integrations" />
          </Suspense>
        </div>
      </section>
    </FounderAppShell>
  );
}
