import type { SubscriptionRecord } from "@/lib/subscriptions/plans";
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

export function AdminSubscriptionSummary({
  subscription,
}: Readonly<{
  subscription: SubscriptionRecord | null | undefined;
}>) {
  if (!subscription) {
    return <p className="text-xs text-slate-500">No subscription record</p>;
  }

  return (
    <dl className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
      <div>
        <dt className="font-medium text-slate-700">Plan</dt>
        <dd>{PLAN_LABELS[subscription.plan_type]}</dd>
      </div>
      <div>
        <dt className="font-medium text-slate-700">Status</dt>
        <dd>{subscriptionStatusLabel(subscription.subscription_status)}</dd>
      </div>
      <div>
        <dt className="font-medium text-slate-700">Role</dt>
        <dd className="capitalize">{subscription.role}</dd>
      </div>
      <div>
        <dt className="font-medium text-slate-700">Trial ends</dt>
        <dd>{formatDate(subscription.trial_ends_at)}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="font-medium text-slate-700">Current period</dt>
        <dd>
          {formatDate(subscription.current_period_start)} – {formatDate(subscription.current_period_end)}
        </dd>
      </div>
    </dl>
  );
}
