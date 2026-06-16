import { Suspense } from "react";
import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { FounderSubscriptionSettingsCard } from "@/components/SubscriptionPanel";
import { getRequestedPlanForProfile } from "@/lib/billing/requested-plan";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { ensureSubscriptionForProfile, getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import { SettingsSidebarNav } from "../SettingsSidebarNav";

export const dynamic = "force-dynamic";

export default async function FounderSettingsBillingPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const subscription =
    (await getSubscriptionForProfile(profile.id)) ??
    (await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role }));
  const requestedPlan = await getRequestedPlanForProfile(profile.id);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <PageHeader
        eyebrow="Settings"
        title="Billing & subscription"
        description="Manage your plan, payment method, and usage."
      />

      <SettingsSidebarNav active="billing" />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Billing &amp; subscription</h2>
          <p className="mt-0.5 text-xs text-slate-500">Plan, payment method, and usage</p>
        </div>
        <div className="p-6">
          <Suspense fallback={<p className="text-sm text-slate-500">Loading subscription…</p>}>
            <FounderSubscriptionSettingsCard subscription={subscription} requestedPlan={requestedPlan} />
          </Suspense>
        </div>
      </section>
    </FounderAppShell>
  );
}
