import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FounderAppShell } from "@/components/FounderAppShell";
import { UpgradeRequestActions } from "@/components/UpgradeRequestActions";
import { CheckoutButton, ManageSubscriptionButton } from "@/components/billing/CheckoutButton";
import {
  getBillingLifecycleLabel,
  getBillingLifecycleStatus,
  getBillingStatusMessage,
} from "@/lib/billing/billing-status";
import { getRequestedPlanForProfile } from "@/lib/billing/requested-plan";
import { getUpgradeUrl } from "@/lib/billing/upgrade";
import { isPaymentsEnabled } from "@/lib/billing/pricing-guard";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { subscriptionStatusLabel } from "@/lib/subscriptions/access";
import { requireRole } from "@/lib/supabase/auth";
import { ensureSubscriptionForProfile, getSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function trialDaysRemaining(trialEndsAt: string | null) {
  if (!trialEndsAt) return null;
  const diffMs = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default async function BillingPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");

  if (profile.role !== "founder") {
    redirect("/upgrade");
  }

  const subscription =
    (await getSubscriptionForProfile(profile.id)) ??
    (await ensureSubscriptionForProfile({ profileId: profile.id, role: profile.role }));
  const requestedPlan = await getRequestedPlanForProfile(profile.id);
  const lifecycle = getBillingLifecycleStatus(subscription, requestedPlan);
  const daysLeft =
    subscription.plan_type === "founder_trial" ? trialDaysRemaining(subscription.trial_ends_at) : null;

  // Check if user has a LemonSqueezy subscription
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();
  const { data: subRaw } = await supabase
    .from("subscriptions")
    .select("ls_customer_id")
    .eq("profile_id", profile.id)
    .single();
  const hasLsCustomer = Boolean((subRaw as Record<string, unknown> | null)?.ls_customer_id);

  return (
    <FounderAppShell profileName={profile.full_name ?? profile.email ?? "Founder"}>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{t("billing")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{t("billing_overview")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          iCapOS billing is powered by Lemon Squeezy. Choose a plan below to start your subscription.
        </p>

        <dl className="mt-8 grid gap-4 text-sm text-slate-700 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="font-medium text-slate-900">Current plan</dt>
            <dd className="mt-1 text-base font-semibold text-slate-950">{PLAN_LABELS[subscription.plan_type]}</dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="font-medium text-slate-900">Subscription status</dt>
            <dd className="mt-1">{subscriptionStatusLabel(subscription.subscription_status)}</dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="font-medium text-slate-900">Billing lifecycle</dt>
            <dd className="mt-1">{getBillingLifecycleLabel(lifecycle)}</dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="font-medium text-slate-900">Signup plan selection</dt>
            <dd className="mt-1">{requestedPlan ? PLAN_LABELS[requestedPlan] : "—"}</dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="font-medium text-slate-900">Trial ends</dt>
            <dd className="mt-1">{formatDate(subscription.trial_ends_at)}</dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="font-medium text-slate-900">Payments</dt>
            <dd className="mt-1">{isPaymentsEnabled() ? "Enabled" : "Not connected yet"}</dd>
          </div>
        </dl>

        {daysLeft != null ? (
          <p
            className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
              daysLeft > 0
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {daysLeft > 0
              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining in your founder trial.`
              : "Your founder trial has expired. Premium features are locked until you upgrade."}
          </p>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-slate-600">
          {getBillingStatusMessage(subscription, lifecycle, requestedPlan)}
        </p>

        {isPaymentsEnabled() && !hasLsCustomer ? (
          <div className="mt-8">
            <h2 className="text-base font-semibold text-slate-950">{t("choose_a_plan")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("select_a_plan_to_activate_your_subscription")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <CheckoutButton planType="founder_basic" label={t("founder_basic_499_mo")} />
              <CheckoutButton planType="founder_professional" label={t("founder_professional_1_000_mo")} recommended />
            </div>
          </div>
        ) : null}

        {isPaymentsEnabled() && hasLsCustomer ? (
          <div className="mt-8 flex flex-wrap gap-3">
            <ManageSubscriptionButton />
            <Link
              href="/founder/settings"
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Account settings
            </Link>
          </div>
        ) : null}

        {!isPaymentsEnabled() ? (
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={getUpgradeUrl()}
              className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white hover:from-indigo-500 hover:to-violet-500"
            >
              View upgrade options
            </Link>
          </div>
        ) : null}

        {!isPaymentsEnabled() ? (
          <div className="mt-10 border-t border-slate-200 pt-8">
            <h2 className="text-base font-semibold text-slate-950">{t("upgrade_requests")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("submit_a_request_no_payment_will_be_processed")}</p>
            <div className="mt-4">
              <UpgradeRequestActions requestedPlan={requestedPlan} />
            </div>
          </div>
        ) : null}
      </section>
    </FounderAppShell>
  );
}
