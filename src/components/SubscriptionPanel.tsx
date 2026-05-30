import type { FeatureKey, SubscriptionRecord } from "@/lib/subscriptions/plans";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { subscriptionStatusLabel } from "@/lib/subscriptions/access";

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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Plan upgrade required</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">This feature is locked on your current plan</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {reason ?? "Upgrade your plan to access this founder workspace feature."}
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
        <a
          href="/founder/settings"
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          View plan in settings
        </a>
        <p className="self-center text-xs text-slate-500">Payment checkout is not enabled yet. Upgrade flows will be added in a later phase.</p>
      </div>
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
    </div>
  );
}

export function FounderSubscriptionSettingsCard({
  subscription,
}: Readonly<{
  subscription: SubscriptionRecord;
}>) {
  const daysLeft =
    subscription.plan_type === "founder_trial" ? trialDaysRemaining(subscription.trial_ends_at) : null;

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <h2 className="text-base font-semibold text-slate-950">Subscription plan</h2>
      <p className="mt-1 text-sm text-slate-600">Your current CapitalOS founder entitlement (billing not connected yet).</p>
      <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-900">Plan</dt>
          <dd>{PLAN_LABELS[subscription.plan_type]}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Status</dt>
          <dd>{subscriptionStatusLabel(subscription.subscription_status)}</dd>
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
    </section>
  );
}
