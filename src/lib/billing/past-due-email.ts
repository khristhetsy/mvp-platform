// The emails a founder gets when a renewal payment fails. No dashes in the copy.

import { renderEmail, type RenderedEmail } from "@/lib/email/layout";
import { formatPtDate, type PastDueStage } from "@/lib/billing/past-due";

export function renderFounderPastDueEmail(input: {
  firstName: string | null;
  planLabel: string;
  endsAt: string;
  billingUrl: string;
  stage?: PastDueStage;
}): RenderedEmail {
  const stage = input.stage ?? "first";
  const date = formatPtDate(input.endsAt);
  const greeting = input.firstName?.trim() ? `Hi ${input.firstName.trim()},` : "Hello,";

  const copy = {
    first: {
      subject: "Your iCapOS payment did not go through",
      headline: "Your payment did not go through",
      intro: `${greeting} we could not collect the renewal payment for your ${input.planLabel} plan.`,
      preheader: `Update your card by ${date} to keep investor outreach running.`,
    },
    midpoint: {
      subject: `Reminder: update your card before ${date}`,
      headline: "Your payment is still unpaid",
      intro: `${greeting} your ${input.planLabel} renewal payment is still unpaid.`,
      preheader: `Investor outreach pauses on ${date} unless your card is updated.`,
    },
    final: {
      subject: "Last day to update your card",
      headline: "Last day to update your card",
      intro: `${greeting} your ${input.planLabel} renewal payment is still unpaid, and today is the last day before investor outreach pauses.`,
      preheader: `Investor outreach pauses after ${date}.`,
    },
  }[stage];

  return renderEmail({
    audience: "founder",
    subject: copy.subject,
    preheader: copy.preheader,
    eyebrow: "Billing",
    headline: copy.headline,
    intro: copy.intro,
    blocks: [
      {
        type: "facts",
        rows: [
          { label: "Plan", value: input.planLabel },
          { label: "Investor outreach pauses", value: date },
        ],
      },
      {
        type: "note",
        tone: "warning",
        text: "Everything works as normal until that date. After it, investor outreach and introduction requests pause until the payment is fixed. Your tools stay on.",
      },
      {
        type: "paragraph",
        text: "The quickest fix is to update your card. We retry the payment automatically once you do.",
      },
    ],
    primary: { label: "Update payment method", url: input.billingUrl },
    footer: { reason: "You are receiving this because a payment on your iCapOS subscription failed." },
  });
}
