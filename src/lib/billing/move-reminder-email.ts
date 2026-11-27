// The one email a Lemon Squeezy customer gets before their renewal. No dashes in the copy.

import { renderEmail, type RenderedEmail } from "@/lib/email/layout";
import { formatPtDate } from "@/lib/billing/past-due";
import { formatMonthlyPrice } from "@/lib/billing/move-reminder-core";

export function renderMoveReminderEmail(input: {
  firstName: string | null;
  planLabel: string;
  priceCents: number;
  renewsAt: string;
  moveUrl: string;
}): RenderedEmail {
  const date = formatPtDate(input.renewsAt);
  const price = formatMonthlyPrice(input.priceCents);
  const greeting = input.firstName?.trim() ? `Hi ${input.firstName.trim()},` : "Hello,";

  return renderEmail({
    audience: "founder",
    subject: `Your iCapOS payment moves to Stripe on ${date}`,
    preheader: `Add your card once. Your ${input.planLabel} plan stays at ${price} per month.`,
    context: "Billing",
    eyebrow: "Billing",
    headline: "Add your card on Stripe",
    intro: `${greeting} our card payments are moving from Lemon Squeezy to Stripe. Add your card once with the button below and your ${input.planLabel} plan continues at ${price} per month, the same as today.`,
    blocks: [
      {
        type: "facts",
        rows: [
          { label: "Plan", value: input.planLabel },
          { label: "Price", value: `${price} per month, the same as today` },
          { label: "First Stripe charge", value: date },
          { label: "Charged today", value: "$0" },
        ],
      },
      {
        type: "paragraph",
        text: "Your Lemon Squeezy payment is cancelled once you finish, so you are never charged twice.",
      },
      { type: "paragraph", text: "The iCapOS team" },
    ],
    primary: { label: "Add my card on Stripe", url: input.moveUrl },
    footer: { reason: "You are receiving this because your iCapOS subscription renews soon and its card payment is moving to Stripe." },
  });
}
