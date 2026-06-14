import { Suspense } from "react";

export const dynamic = "force-dynamic";
import { FounderAppShell } from "@/components/FounderAppShell";
import { PageHeader } from "@/components/ui/PageHeader";
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
      <PageHeader
        eyebrow="Founder workspace"
        title="Company settings"
        description="Manage your company profile, billing, integrations, and feedback."
      />

      {/* Section: Company profile */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">🏢 Company profile</h2>
          <p className="mt-0.5 text-xs text-slate-500">Edit your public listing and company details</p>
        </div>
        <div className="p-6">
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
        </div>
      </section>

      {/* Section: Billing & subscription */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">💳 Billing &amp; subscription</h2>
          <p className="mt-0.5 text-xs text-slate-500">Plan, payment method, and usage</p>
        </div>
        <div className="p-6">
          <FounderSubscriptionSettingsCard subscription={subscription} requestedPlan={requestedPlan} />
        </div>
      </section>

      {/* Section: Integrations */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">🔗 Integrations</h2>
          <p className="mt-0.5 text-xs text-slate-500">Connected accounts and tools</p>
        </div>
        <div className="p-6 space-y-6">
          <DraftEmailPanel
            role="founder"
            entityType={company ? "company" : undefined}
            entityId={company?.id}
            defaultTemplate="founder_investor_intro_followup"
            googleConnected={googleStatus.connected}
          />
          <Suspense fallback={<p className="text-sm text-slate-500">Loading Google connection…</p>}>
            <GoogleCalendarConnectionCard status={googleStatus} returnPath="/founder/settings" />
          </Suspense>
        </div>
      </section>

      {/* Section: Feedback */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">💬 Feedback</h2>
          <p className="mt-0.5 text-xs text-slate-500">Help us improve CapitalOS</p>
        </div>
        <div className="p-6">
          <BetaFeedbackForm />
        </div>
      </section>
    </FounderAppShell>
  );
}
