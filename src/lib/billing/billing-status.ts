import { isTrialActive, isTrialExpired } from "@/lib/subscriptions/access";
import type { PlanType, SubscriptionRecord } from "@/lib/subscriptions/plans";
import { PLAN_LABELS } from "@/lib/subscriptions/plans";
import { isPaymentsEnabled } from "@/lib/billing/pricing-guard";

export type BillingLifecycleStatus =
  | "trial_active"
  | "trial_expired"
  | "paid_active"
  | "paid_pending_activation"
  | "subscription_inactive"
  | "free_investor"
  | "internal";

export function getBillingLifecycleStatus(
  subscription: SubscriptionRecord,
  requestedPlan?: PlanType | null,
): BillingLifecycleStatus {
  if (subscription.plan_type === "admin_internal") {
    return "internal";
  }

  if (subscription.plan_type === "investor_free") {
    return "free_investor";
  }

  if (subscription.plan_type === "founder_trial") {
    if (isTrialActive(subscription)) {
      return "trial_active";
    }

    if (isTrialExpired(subscription)) {
      return "trial_expired";
    }

    return "trial_active";
  }

  if (subscription.plan_type === "founder_basic" || subscription.plan_type === "founder_professional") {
    if (subscription.subscription_status === "active") {
      return "paid_active";
    }

    if (
      requestedPlan &&
      (requestedPlan === "founder_basic" || requestedPlan === "founder_professional") &&
      !isPaymentsEnabled()
    ) {
      return "paid_pending_activation";
    }

    if (subscription.subscription_status === "expired" || subscription.subscription_status === "canceled") {
      return "subscription_inactive";
    }

    return "paid_pending_activation";
  }

  return "subscription_inactive";
}

export function getBillingLifecycleLabel(status: BillingLifecycleStatus) {
  switch (status) {
    case "trial_active":
      return "Full access";
    case "trial_expired":
      return "Distribution off";
    case "paid_active":
      return "Paid subscription active";
    case "paid_pending_activation":
      return "Upgrade requested — billing pending";
    case "subscription_inactive":
      return "Subscription inactive";
    case "free_investor":
      return "Free investor account";
    case "internal":
      return "Internal access";
    default:
      return status;
  }
}

export function getBillingStatusMessage(
  subscription: SubscriptionRecord,
  lifecycle: BillingLifecycleStatus,
  requestedPlan?: PlanType | null,
) {
  switch (lifecycle) {
    case "trial_active":
      return "You have full access right now, including investor distribution. Every founder tool is free forever; billing isn't connected yet.";
    case "trial_expired":
      return "Every founder tool stays free. To reach investors — reveal your matches and send your one-pager — choose a distribution plan.";
    case "paid_pending_activation":
      return requestedPlan
        ? `You selected ${PLAN_LABELS[requestedPlan]}. Our team will activate billing when checkout goes live.`
        : "Upgrade requests are queued. Payment checkout is not enabled yet.";
    case "paid_active":
      return `Your ${PLAN_LABELS[subscription.plan_type]} subscription is active.`;
    case "free_investor":
      return "Investor accounts are free with full workspace access.";
    case "internal":
      return "Internal iCapOS access — no billing restrictions.";
    case "subscription_inactive":
      return "Every founder tool stays free. Choose a plan when you want to turn investor distribution back on.";
    default:
      return "Billing status available in your account settings.";
  }
}
