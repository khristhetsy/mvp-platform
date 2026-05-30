import Link from "next/link";
import type { FeatureKey, SubscriptionRecord } from "@/lib/subscriptions/plans";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { subscriptionStatusLabel, isTrialExpired } from "@/lib/subscriptions/access";
import { getUpgradeUrl } from "@/lib/billing/upgrade";
import {
  getBillingLifecycleLabel,
  getBillingLifecycleStatus,
} from "@/lib/billing/billing-status";
import type { PlanType } from "@/lib/subscriptions/plans";

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function trialDaysRemaining(trialEndsAt: string | null) {
  if (!trialEndsAt) {
    return null;
  }

  const diffMs = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function SubscriptionLockedPanel({
  subscription,
  reason,
  featureKey,
}: Readonly<{
  subscription: SubscriptionRecord;
  reason: string | null;
  featureKey: FeatureKey;
}>) {
  const daysLeft = subscription.plan_type === "founder_trial" ? trialDaysRemaining(subscription.trial_ends_at) : null;
  const trialExpired = subscription.plan_type === "founder_trial" && isTrialExpired(subscription);
  const upgradeHref = getUpgradeUrl(featureKey);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Plan upgrade required</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        {trialExpired ? "Your free trial has expired" : "This feature is locked on your current plan"}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {reason ??
          (trialExpired
            ? "Upgrade to continue using premium founder features. Core tools and settings remain available."
            : "Upgrade your plan to access this founder workspace feature.")}
      </p>
      <div className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
        <p>
          <span className="font-medium text-slate-900">Current plan:</span> {PLAN_LABELS[subscription.plan_type]}
        </p>
        <p>
          <span className="font-medium text-slate-900">Status:</span> {subscriptionStatusLabel(subscription.subscription_status)}
        </p>
        {daysLeft != null ? (
          <p>
            <span className="font-medium text-slate-900">Trial remaining:</span> {daysLeft} day{daysLeft === 1 ? "" : "s"}
          </p>
        ) : null}
        <p>
          <span className="font-medium text-slate-900">Requested feature:</span> {featureKey.replaceAll("_", " ")}
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={upgradeHref}
          className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white hover:from-indigo-500 hover:to-violet-500"
        >
          View upgrade options
        </Link>
        <Link
          href="/founder/settings"
          className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Billing & plan settings
        </Link>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Payment checkout is not enabled yet. Submit an upgrade request and our team will follow up when billing goes live.
      </p>
    </section>
  );
}

export function SubscriptionPlanBadge({
  subscription,
}: Readonly<{
  subscription: SubscriptionRecord | null;
}>) {
  if (!subscription) {
    return null;
  }

  const daysLeft =
    subscription.plan_type === "founder_trial" && subscription.subscription_status === "trialing"
      ? trialDaysRemaining(subscription.trial_ends_at)
      : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <p className="font-semibold text-slate-900">{PLAN_LABELS[subscription.plan_type]}</p>
      <p className="mt-0.5">{subscriptionStatusLabel(subscription.subscription_status)}</p>
      {daysLeft != null ? <p className="mt-0.5 text-slate-500">{daysLeft} day trial left</p> : null}
      <Link href="/upgrade" className="mt-1 inline-block text-indigo-600 hover:text-indigo-500">
        Upgrade
      </Link>
    </div>
  );
}

export function FounderSubscriptionSettingsCard({
  subscription,
  requestedPlan,
}: Readonly<{
  subscription: SubscriptionRecord;
  requestedPlan?: PlanType | null;
}>) {
  const daysLeft =
    subscription.plan_type === "founder_trial" ? trialDaysRemaining(subscription.trial_ends_at) : null;
  const lifecycle = getBillingLifecycleStatus(subscription, requestedPlan ?? null);

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Subscription & billing</h2>
          <p className="mt-1 text-sm text-slate-600">Current plan, trial status, and upgrade options.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/upgrade"
            className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-500 hover:to-violet-500"
          >
            Upgrade plan
          </Link>
          <Link
            href="/billing"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Billing overview
          </Link>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-900">Current plan</dt>
          <dd>{PLAN_LABELS[subscription.plan_type]}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Subscription status</dt>
          <dd>{subscriptionStatusLabel(subscription.subscription_status)}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Billing status</dt>
          <dd>{getBillingLifecycleLabel(lifecycle)}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Signup plan selection</dt>
          <dd>{requestedPlan ? PLAN_LABELS[requestedPlan] : "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Trial ends</dt>
          <dd>{formatDate(subscription.trial_ends_at)}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Current period</dt>
          <dd>
            {formatDate(subscription.current_period_start)} – {formatDate(subscription.current_period_end)}
          </dd>
        </div>
      </dl>
      {daysLeft != null ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {daysLeft > 0
            ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining in your founder trial.`
            : "Your founder trial has expired. Premium features are locked until you upgrade."}
        </p>
      ) : null}
      <p className="mt-4 text-xs text-slate-500">
        Compare plans on{" "}
        <Link href="/pricing" className="font-semibold text-indigo-600 hover:text-indigo-500">
          pricing
        </Link>
        . Payment checkout is not connected yet.
      </p>
    </section>
  );
}
