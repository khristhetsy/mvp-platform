import { createNotification, hasRecentNotification } from "@/lib/notifications/notifications";
import { isTrialActive, isTrialExpired } from "@/lib/subscriptions/access";
import type { SubscriptionRecord } from "@/lib/subscriptions/plans";

function trialDaysRemaining(trialEndsAt: string | null) {
  if (!trialEndsAt) return null;
  const diffMs = new Date(trialEndsAt).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export async function maybeNotifyTrialStatus(profileId: string, subscription: SubscriptionRecord) {
  if (subscription.plan_type !== "founder_trial") {
    return;
  }

  if (isTrialExpired(subscription)) {
    const exists = await hasRecentNotification({
      recipientUserId: profileId,
      type: "trial_expired",
      entityId: subscription.id,
      withinHours: 168,
    });

    if (!exists) {
      await createNotification({
        recipientUserId: profileId,
        type: "trial_expired",
        title: "Free trial expired",
        message:
          "Your founder trial has ended. Upgrade to Professional to restore premium workspace features.",
        entityType: "subscription",
        entityId: subscription.id,
      });
    }

    return;
  }

  if (!isTrialActive(subscription)) {
    return;
  }

  const daysLeft = trialDaysRemaining(subscription.trial_ends_at);
  if (daysLeft == null || daysLeft > 1) {
    return;
  }

  const exists = await hasRecentNotification({
    recipientUserId: profileId,
    type: "trial_ending_soon",
    entityId: subscription.id,
    withinHours: 24,
  });

  if (!exists) {
    await createNotification({
      recipientUserId: profileId,
      type: "trial_ending_soon",
      title: "Trial ending soon",
      message:
        daysLeft <= 0
          ? "Your founder trial ends today. Upgrade to keep access to premium features."
          : `Your founder trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Upgrade to keep premium features.`,
      entityType: "subscription",
      entityId: subscription.id,
    });
  }
}
