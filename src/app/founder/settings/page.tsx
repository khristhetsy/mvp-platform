import { FounderAppShell } from "@/components/FounderAppShell";
import { FounderSubscriptionSettingsCard } from "@/components/SubscriptionPanel";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { ensureSubscriptionForProfile, getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import { CompanySettingsForm } from "./settings-form";

export default async function FounderSettingsPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const subscription =
    (await getSubscriptionForProfile(profile.id)) ??
    (await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role }));

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Company settings</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Update your company profile details used across the platform.</p>

        <CompanySettingsForm company={company} />
        <FounderSubscriptionSettingsCard subscription={subscription} />
      </section>
    </FounderAppShell>
  );
}
