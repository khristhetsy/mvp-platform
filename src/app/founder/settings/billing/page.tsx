import { Suspense } from "react";
import { FounderAppShell } from "@/components/FounderAppShell";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { FounderSubscriptionSettingsCard } from "@/components/SubscriptionPanel";
import { getRequestedPlanForProfile } from "@/lib/billing/requested-plan";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { ensureSubscriptionForProfile, getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import { SettingsSidebarNav } from "../SettingsSidebarNav";
import { loadFounderWireState } from "@/lib/billing/wire";
import { wireDatePT } from "@/lib/billing/wire-core";
import { WireCheckoutPanel, WireInvoiceList } from "@/components/billing/WireCheckoutPanel";

export const dynamic = "force-dynamic";

export default async function FounderSettingsBillingPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const { company } = await getActiveCompanyForUser(profile);
  const subscription =
    (await getSubscriptionForProfile(profile.id)) ??
    (await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role }));
  const requestedPlan = await getRequestedPlanForProfile(profile.id);
  const wire = await loadFounderWireState(profile.id);
  const premiumActive = subscription.plan_type === "founder_premium" && subscription.subscription_status === "active";

  return (
    <FounderAppShell
      profileName={profile.full_name ?? profile.email ?? "Founder"}
      profileSubtitle={company?.company_name ?? "Your company"}
    >
      <PageHeader
        eyebrow={t("settings")}
        title={t("billing_subscription")}
        description={t("manage_your_plan_payment_method_and_usage")}
      />

      <SettingsSidebarNav active="billing" />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">{t("billing_subscription")}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t("plan_payment_method_and_usage")}</p>
        </div>
        <div className="p-6">
          <Suspense fallback={<p className="text-sm text-slate-500">{t("loading_subscription")}</p>}>
            <FounderSubscriptionSettingsCard subscription={subscription} requestedPlan={requestedPlan} />
          </Suspense>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Premium by bank wire</h2>
          <p className="mt-0.5 text-xs text-slate-500">Invoices, wire instructions and payment status</p>
        </div>
        <div className="space-y-5 p-6">
          {premiumActive && !wire.openInvoice ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Premium is active until {wireDatePT(subscription.current_period_end)}. We email your next invoice 7 days before then.
            </p>
          ) : (
            <WireCheckoutPanel
              monthlyLabel={wire.monthlyLabel}
              quarterlyLabel={wire.quarterlyLabel}
              instructions={wire.instructions}
              openInvoice={wire.openInvoice}
            />
          )}
          {wire.invoices.length ? <WireInvoiceList invoices={wire.invoices} /> : null}
        </div>
      </section>
    </FounderAppShell>
  );
}
