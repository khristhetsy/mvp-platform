import { renderEmail, NOT_A_BROKER_DEALER, type RenderedEmail } from "@/lib/email/layout";

/** The email an investor gets when a founder invites them into the data room. Pure. */
export function buildDataRoomInviteEmail(input: {
  founderName: string;
  companyName: string;
  message: string | null;
  onePagerUrl: string | null;
  appUrl: string;
  expiresInDays: number | null;
}): RenderedEmail {
  const message = input.message?.trim() || null;
  return renderEmail({
    audience: "investor",
    subject: `${input.founderName} invited you to the ${input.companyName} data room`,
    preheader: `${input.companyName} gave you access to its one pager and data room on iCapOS.`,
    context: input.companyName,
    eyebrow: "Data room invitation",
    headline: `You are invited to the ${input.companyName} data room`,
    intro: `${input.founderName} gave you access to the ${input.companyName} one pager and data room on iCapOS.`,
    blocks: [
      ...(message ? [{ type: "quote" as const, label: input.founderName, text: message }] : []),
      {
        type: "note" as const,
        text: input.expiresInDays
          ? `Your access runs for ${input.expiresInDays} days. The founder can end it sooner.`
          : "The founder can end your access at any time.",
      },
    ],
    primary: input.onePagerUrl ? { label: "View the one pager", url: input.onePagerUrl } : { label: "Open iCapOS", url: input.appUrl },
    secondary: input.onePagerUrl ? { label: "Open iCapOS", url: input.appUrl } : null,
    footer: {
      reason: `You received this because ${input.founderName} invited you to the ${input.companyName} data room on iCapOS.`,
      lines: [NOT_A_BROKER_DEALER],
    },
  });
}
