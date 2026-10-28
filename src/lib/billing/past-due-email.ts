// The email a founder gets when a renewal payment fails. No dashes in the copy.

import { renderEmail, type RenderedEmail } from "@/lib/email/layout";
import { formatPtDate, graceDaysLeft } from "@/lib/billing/past-due";

export function renderFounderPastDueEmail(input: {
  firstName: string | null;
  planLabel: string;
  endsAt: string;
  billingUrl: string;
  now?: Date;
}): RenderedEmail {
  const days = graceDaysLeft(input.endsAt, input.now);
  const date = formatPtDate(input.endsAt);
  const greeting = input.firstName?.trim() ? `Hi ${input.firstName.trim()},` : "Hello,";
  return renderEmail({
    audience: "founder",
    subject: "Your iCapOS payment did not go through",
    preheader: `Update your card by ${date} to keep your access.`,
    eyebrow: "Billing",
    headline: "Your payment did not go through",
    intro: `${greeting} we could not collect the renewal payment for your ${input.planLabel} plan.`,
    blocks: [
      {
        type: "facts",
        rows: [
          { label: "Plan", value: input.planLabel },
          { label: "Access continues until", value: `${date} (${days} day${days === 1 ? "" : "s"} left)` },
        ],
      },
      {
        type: "note",
        tone: "warning",
        text: "Your account works as normal until that date. If the payment is not fixed by then, your access will pause.",
      },
      {
        type: "paragraph",
        text: "The quickest fix is to update your card. We will retry the payment automatically once you do.",
      },
    ],
    primary: { label: "Update payment method", url: input.billingUrl },
    footer: { reason: "You are receiving this because a payment on your iCapOS subscription failed." },
  });
}
