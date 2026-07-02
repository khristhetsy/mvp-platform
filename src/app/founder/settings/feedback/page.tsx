import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { getTranslations } from "next-intl/server";
import { BetaFeedbackForm } from "@/components/beta/BetaFeedbackForm";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { SettingsSidebarNav } from "../SettingsSidebarNav";

export const dynamic = "force-dynamic";

export default async function FounderSettingsFeedbackPage() {
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
        title={t("feedback")}
        description={t("help_us_improve_icapos_your_input_shapes_the_r")}
      />

      <SettingsSidebarNav active="feedback" />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">{t("feedback")}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t("help_us_improve_icapos")}</p>
        </div>
        <div className="p-6">
          <BetaFeedbackForm />
        </div>
      </section>
    </FounderAppShell>
  );
}
