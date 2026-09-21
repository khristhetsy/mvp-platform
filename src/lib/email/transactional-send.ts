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
  /** Optional HTML alternative. Plain `body` is always sent as the text part. */
  html?: string | null;
  /** Where replies should land. Staff outreach sets this to the sender, so a
   *  founder replying to a platform-addressed email reaches a person. */
  replyTo?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.TRANSACTIONAL_EMAIL_FROM?.trim() ??
    process.env.EMAIL_FROM?.trim() ??
    "iCapOS <no-reply@mail.icapos.com>";

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
        ...(input.html ? { html: input.html } : {}),
        ...(input.replyTo ? { reply_to: [input.replyTo] } : {}),
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
