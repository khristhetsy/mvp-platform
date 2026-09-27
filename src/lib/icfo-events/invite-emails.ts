// Invitation and materials-reminder emails for event presenters.
//
// The destination differs by audience and is decided upstream by
// `respondPath`: founders land in their portal, exhibitors on a signed link.
// This module only renders and sends.
import "server-only";

import { sendEmail } from "@/lib/email/send-email";
import { INVITE_ROLES, type InviteRole } from "./invite-rules";
import type { PresenterInvite } from "./invites";
import { NOT_A_BROKER_DEALER, renderEmail, type RenderedEmail } from "@/lib/email/layout";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");
}

function firstName(invite: PresenterInvite): string {
  const name = invite.displayName?.trim();
  if (name) return name.split(/\s+/)[0];
  return "there";
}

/** What this role is being asked to send in, in plain words. */
function asksFor(role: InviteRole): string | null {
  const spec = INVITE_ROLES[role];
  if (spec.wantsVideo && spec.wantsDeck) return "a pitch video link and your deck as a PDF";
  if (spec.wantsDeck) return "your deck as a PDF";
  if (spec.wantsVideo) return "a pitch video link";
  return null;
}

const FOOTER_REASON = "You were invited by the iCFO events team.";

/** The invitation. Pure. */
export function buildInviteEmail(invite: PresenterInvite, url: string): RenderedEmail {
  const spec = INVITE_ROLES[invite.role];
  const event = invite.eventTitle ?? "an iCFO event";
  const asks = asksFor(invite.role);
  const due = invite.materialsDue
    ? new Date(`${invite.materialsDue}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "long" })
    : null;
  const note = invite.note?.trim();
  return renderEmail({
    audience: "shared",
    subject: `You're invited to ${event}`,
    preheader: `Join as a ${spec.label}.${asks ? ` We'll need ${asks}${due ? ` by ${due}` : ""}.` : ""}`,
    context: "Events",
    eyebrow: "Invitation",
    headline: `Join ${event} as a ${spec.label}`,
    intro: `Hi ${firstName(invite)}, you're invited to take part in ${event} as a ${spec.label}.`,
    blocks: [
      ...(note ? [{ type: "quote" as const, label: "Note from the organizers", text: note }] : []),
      ...(asks ? [{ type: "paragraph" as const, text: `We'll need ${asks}${due ? ` by ${due}` : ""}. You can add them from the same page after you accept.` }] : []),
    ],
    primary: { label: "Accept or decline", url },
    footer: { reason: FOOTER_REASON, lines: [NOT_A_BROKER_DEALER] },
  });
}

/** The materials reminder. Pure. */
export function buildMaterialsReminderEmail(invite: PresenterInvite, url: string, outstanding: string[]): RenderedEmail {
  const event = invite.eventTitle ?? "your iCFO event";
  const due = invite.materialsDue
    ? new Date(`${invite.materialsDue}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "long" })
    : null;
  return renderEmail({
    audience: "shared",
    subject: `Still needed for ${event}: ${outstanding.join(" and ").toLowerCase()}`,
    preheader: `${due ? `Due ${due}. ` : ""}This stops automatically once everything is in.`,
    context: "Events",
    eyebrow: "Event · Reminder",
    headline: `${outstanding.length} item${outstanding.length === 1 ? "" : "s"} still needed`,
    intro: `Hi ${firstName(invite)}, you're confirmed for ${event}. We're still waiting on:`,
    blocks: [
      { type: "checklist", title: due ? `Due ${due}` : undefined, items: outstanding.map((label) => ({ label, done: false })) },
      { type: "paragraph", text: "This stops automatically once everything is in." },
    ],
    primary: { label: "Add them now", url },
    footer: { reason: FOOTER_REASON, lines: [NOT_A_BROKER_DEALER] },
  });
}

export async function sendInviteEmail(invite: PresenterInvite, path: string): Promise<boolean> {
  const mail = buildInviteEmail(invite, `${appUrl()}${path}`);
  return sendEmail({ to: invite.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
}

/**
 * Materials reminder. Only ever names what this role was actually asked for —
 * chasing an exhibitor for a pitch video nobody requested is how a reminder
 * stops being believed.
 */
export async function sendMaterialsReminder(
  invite: PresenterInvite,
  path: string,
  outstanding: string[],
): Promise<boolean> {
  if (!outstanding.length) return false;
  const mail = buildMaterialsReminderEmail(invite, `${appUrl()}${path}`, outstanding);
  return sendEmail({ to: invite.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS" });
}
