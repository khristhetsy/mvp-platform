import { createNotification } from "@/lib/notifications/notifications";

export async function notifyGoogleAccountConnected(input: { userId: string; email: string }) {
  return createNotification({
    recipientUserId: input.userId,
    actorUserId: input.userId,
    type: "google_account_connected",
    title: "Google account connected",
    message: `${input.email} is connected for future Calendar and Meet scheduling.`,
    entityType: "connected_account",
    entityId: input.userId,
  });
}

export async function notifyGoogleAccountDisconnected(input: { userId: string }) {
  return createNotification({
    recipientUserId: input.userId,
    actorUserId: input.userId,
    type: "google_account_disconnected",
    title: "Google account disconnected",
    message: "Your Google account was disconnected. Connect again to enable Calendar scheduling later.",
    entityType: "connected_account",
    entityId: input.userId,
  });
}
