import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { loadBudgetConfig } from "@/lib/notifications/founder-email-budget/config";
import { loadFounderPrefs } from "@/lib/notifications/founder-email-budget/prefs";
import { cohortFor } from "@/lib/notifications/founder-email-budget/rules";
import { SettingsSidebarNav } from "../SettingsSidebarNav";
import { FounderEmailSettings } from "./FounderEmailSettings";

export const dynamic = "force-dynamic";

export default async function FounderSettingsEmailPage() {
  const profile = await requireRole(["founder"]);
  const [{ company }, cfg, prefs] = await Promise.all([
    getActiveCompanyForUser(profile),
    loadBudgetConfig(),
    loadFounderPrefs(profile.id),
  ]);
  const active = cohortFor(profile.id, cfg) === "rollout";

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <PageHeader
        eyebrow="Settings"
        title="Email"
        description="Choose how often iCapOS emails you. Everything is always in your inbox inside iCapOS."
      />

      <SettingsSidebarNav active="email" />

      {active ? (
        <FounderEmailSettings initial={prefs} defaultSendHour={cfg.sendHour} />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">Email summaries are rolling out</h2>
          <p className="mt-1 text-sm text-slate-600">
            You get each update by email as it happens today. When summaries reach your account, you will be able to choose a daily
            digest, a weekly summary or instant alerts only here.
          </p>
        </section>
      )}
    </FounderAppShell>
  );
}
