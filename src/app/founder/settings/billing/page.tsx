import { Suspense } from "react";
import Link from "next/link";
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
import { PlanActions } from "@/components/billing/PlanActions";
import { PortalCards } from "@/components/billing/PortalCards";
import { BillingAddressCard } from "@/components/billing/BillingAddressCard";
import { readStoredAddress } from "@/lib/billing/address";
import { awaitingCardCheckout, isCardPlan } from "@/lib/billing/plan-change";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { getCustomerDetails, getSubscriptionDetails } from "@/lib/lemonsqueezy";

export const dynamic = "force-dynamic";

export default async function FounderSettingsBillingPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const tb = await getTranslations("billingManage");
  const { company } = await getActiveCompanyForUser(profile);
  const subscription =
    (await getSubscriptionForProfile(profile.id)) ??
    (await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role }));
  const requestedPlan = await getRequestedPlanForProfile(profile.id);
  const wire = await loadFounderWireState(profile.id);
  const cardPlan = isCardPlan(subscription.plan_type) && Boolean(subscription.ls_subscription_id);
  const lsDetails = cardPlan && subscription.ls_subscription_id ? await getSubscriptionDetails(subscription.ls_subscription_id) : null;
  const lsCustomer = cardPlan && subscription.ls_customer_id ? await getCustomerDetails(subscription.ls_customer_id) : null;
  const place = lsCustomer ? [lsCustomer.city, lsCustomer.region, lsCustomer.country].filter(Boolean).join(", ") : "";
  const wirePlan = subscription.plan_type === "founder_premium" && subscription.subscription_status === "active";
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
            <FounderSubscriptionSettingsCard
              subscription={subscription}
              requestedPlan={requestedPlan}
              actions={
                cardPlan || wirePlan ? (
                  <PlanActions
                    planType={subscription.plan_type}
                    mode={wirePlan ? "wire" : "card"}
                    cancelAtPeriodEnd={Boolean(subscription.cancel_at_period_end)}
                    cancelReason={subscription.cancel_reason ?? null}
                    pendingPlan={subscription.pending_plan_type ?? null}
                    periodEnd={subscription.current_period_end}
                  />
                ) : null
              }
            />
          </Suspense>
          {awaitingCardCheckout(subscription) ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              <span>{tb("start_plan_prompt", { plan: PLAN_LABELS[subscription.pending_plan_type as keyof typeof PLAN_LABELS] })}</span>
              <Link href="/billing" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                {tb("start_plan_button", { plan: PLAN_LABELS[subscription.pending_plan_type as keyof typeof PLAN_LABELS] })}
              </Link>
            </div>
          ) : null}
          {cardPlan ? (
            <PortalCards cardBrand={lsDetails?.cardBrand ?? null} cardLast4={lsDetails?.cardLastFour ?? null} place={place || null} />
          ) : null}
          {subscription.plan_type === "founder_premium" ? (
            <BillingAddressCard initial={readStoredAddress(subscription.billing_address)} defaultCompany={company?.company_name ?? null} />
          ) : null}
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
