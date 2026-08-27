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
        title: "Full-access period ended",
        message:
          "Your founder tools stay free, forever. Add a plan whenever you're ready to reach investors — reveal your matches and send your one-pager.",
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
      title: "Full access ending soon",
      message:
        daysLeft <= 0
          ? "Your full-access period ends today. Your tools stay free — add a plan to keep reaching investors."
          : `Your full-access period ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Your tools stay free — add a plan to keep reaching investors.`,
      entityType: "subscription",
      entityId: subscription.id,
    });
  }
}
