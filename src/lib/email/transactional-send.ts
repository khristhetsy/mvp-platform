import { createNotification } from "@/lib/notifications/notifications";

const RESEND_API_URL = "https://api.resend.com/emails";

export type TransactionalEmailResult = {
  channel: "resend" | "notification";
  delivered: boolean;
};

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  body: string;
  founderId: string;
  notificationType: string;
  deepLink?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.TRANSACTIONAL_EMAIL_FROM?.trim() ?? "CapitalOS <notifications@mail.capitalos.app>";

  if (apiKey && input.to.includes("@")) {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.body,
      }),
    });

    if (!response.ok) {
      throw new Error(`Email delivery failed: ${await response.text()}`);
    }

    return { channel: "resend", delivered: true } satisfies TransactionalEmailResult;
  }

  const notification = await createNotification({
    recipientUserId: input.founderId,
    type: input.notificationType,
    title: input.subject,
    message: input.body.slice(0, 500),
    deepLink: input.deepLink ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    dedupeKey: input.dedupeKey ?? null,
  });

  if (!notification) {
    throw new Error("Email provider is not configured and in-app notification delivery failed.");
  }

  return { channel: "notification", delivered: true } satisfies TransactionalEmailResult;
}
