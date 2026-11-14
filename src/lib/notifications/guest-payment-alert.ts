import { createNotification, hasRecentNotification } from "@/lib/notifications/notifications";
import { shouldSendEmail } from "@/lib/notifications/preferences";
import { isInternalAccount } from "@/lib/notifications/internal-accounts";
import { NEW_CUSTOMER_TYPES, staffRecipients } from "@/lib/notifications/new-customer-alerts";
import { sendEmail } from "@/lib/email/send-email";
import { absoluteUrl, button, escapeHtml } from "@/lib/activity/email-templates";

export const GUEST_PAYMENT_LINK = "/admin/billing/paid-signups";

export type GuestPaymentAlertInput = {
  signupId: string;
  email: string;
  name?: string | null;
  company?: string | null;
  planLabel: string;
  currentPeriodEnd?: string | null;
};

/** Title and one line message, shared by the bell and the email. Pure, so a test reads what staff see. */
export function buildGuestPaymentAlert(input: GuestPaymentAlertInput): { title: string; message: string; subject: string; detail: string } {
  const who = input.name?.trim() || input.company?.trim() || input.email;
  const company = input.name?.trim() && input.company?.trim() ? `${input.company.trim()} · ` : "";
  const end = input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null;
  const through = end && Number.isFinite(end.getTime()) ? ` The subscription is active through ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}.` : "";
  return {
    title: `New payment: ${who}, ${input.planLabel}`,
    message: `${company}${input.email} · Login not created yet.`,
    subject: `New payment: ${who} (${input.planLabel})`,
    detail: `${who} paid for ${input.planLabel}.${through} A login link was emailed to ${input.email}, and the login is not created yet.`,
  };
}

/**
 * Tells every admin and analyst the moment someone pays before they have a login.
 * Follows the same "New founder signup" and payment toggle as the other staff
 * alerts. Never throws: a failed alert must not break the payment webhook.
 */
export async function alertStaffGuestPayment(input: GuestPaymentAlertInput): Promise<void> {
  try {
    if (isInternalAccount({ email: input.email, role: "founder" })) return;
    const type = NEW_CUSTOMER_TYPES.payment;
    const built = buildGuestPaymentAlert(input);
    const url = absoluteUrl(GUEST_PAYMENT_LINK);
    const staff = await staffRecipients();

    await Promise.all(
      staff.map(async (person) => {
        if (await hasRecentNotification({ recipientUserId: person.id, type, entityId: input.signupId, withinHours: 24 * 90 })) return;
        await createNotification({
          recipientUserId: person.id,
          type,
          title: built.title,
          message: built.message,
          entityType: "paid_signup",
          entityId: input.signupId,
          deepLink: GUEST_PAYMENT_LINK,
          dedupeKey: `${type}:${input.signupId}`,
        });
        if (!person.email) return;
        if (!(await shouldSendEmail(person.id, type, "critical"))) return;
        await sendEmail({
          to: person.email,
          subject: built.subject,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;"><p><strong>${escapeHtml(built.title)}</strong></p><p>${escapeHtml(built.detail)}</p><p>${button("Open signup", url, true)}</p><p style="color:#888;font-size:12px;">Turn these off under Notifications, "New founder signup".</p></div>`,
          text: `${built.title}\n${built.detail}\n${url}`,
          source: "staff_alert:guest_payment",
          audience: "staff",
        });
      }),
    );
  } catch (error) {
    console.warn("[guest-payment-alert] failed", error);
  }
}
