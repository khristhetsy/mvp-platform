import { Suspense } from "react";
import { FounderAppShell } from "@/components/FounderAppShell";
import { GoogleCalendarConnectionCard } from "@/components/GoogleCalendarConnectionCard";
import { FounderSubscriptionSettingsCard } from "@/components/SubscriptionPanel";
import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRequestedPlanForProfile } from "@/lib/billing/requested-plan";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { ensureSubscriptionForProfile, getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import { CollaborationDiscussionPanel } from "@/components/collaboration/CollaborationDiscussionPanel";
import { BetaFeedbackForm } from "@/components/beta/BetaFeedbackForm";
import { DraftEmailPanel } from "@/components/email/DraftEmailPanel";
import { CompanySettingsForm } from "./settings-form";

export default async function FounderSettingsPage() {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  const subscription =
    (await getSubscriptionForProfile(profile.id)) ??
    (await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role }));
  const requestedPlan = await getRequestedPlanForProfile(profile.id);
  const supabase = await createServerSupabaseClient();
  const googleStatus = await getGoogleConnectionStatus(supabase, profile.id);

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <section className="cap-surface-card p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--navy)]">Company settings</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">Update your company profile details used across the platform.</p>

        <CompanySettingsForm company={company} />
        {company ? (
          <div className="mt-8">
            <CollaborationDiscussionPanel
              entityType="company"
              entityId={company.id}
              title="Company discussion"
            />
          </div>
        ) : null}
        <FounderSubscriptionSettingsCard subscription={subscription} requestedPlan={requestedPlan} />
        <div className="mt-8">
          <DraftEmailPanel
            role="founder"
            entityType={company ? "company" : undefined}
            entityId={company?.id}
            defaultTemplate="founder_investor_intro_followup"
          />
        </div>
        <Suspense fallback={<p className="mt-8 text-sm text-slate-500">Loading Google connection…</p>}>
          <GoogleCalendarConnectionCard status={googleStatus} returnPath="/founder/settings" />
        </Suspense>
        <BetaFeedbackForm />
      </section>
    </FounderAppShell>
  );
}
