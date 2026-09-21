// Invitation and materials-reminder emails for event presenters.
//
// The destination differs by audience and is decided upstream by
// `respondPath`: founders land in their portal, exhibitors on a signed link.
// This module only renders and sends.
import "server-only";

import { sendEmail } from "@/lib/email/send-email";
import { INVITE_ROLES, type InviteRole } from "./invite-rules";
import type { PresenterInvite } from "./invites";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://icapos.com").replace(/\/$/, "");
}

function firstName(invite: PresenterInvite): string {
  const name = invite.displayName?.trim();
  if (name) return name.split(/\s+/)[0];
  return "there";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** What this role is being asked to send in, in plain words. */
function asksFor(role: InviteRole): string | null {
  const spec = INVITE_ROLES[role];
  if (spec.wantsVideo && spec.wantsDeck) return "a pitch video link and your deck as a PDF";
  if (spec.wantsDeck) return "your deck as a PDF";
  if (spec.wantsVideo) return "a pitch video link";
  return null;
}

const FOOTER =
  `<p style="color:#667;font-size:12px">iCapOS is not a broker-dealer and does not raise capital or guarantee funding.</p>`;

export async function sendInviteEmail(invite: PresenterInvite, path: string): Promise<boolean> {
  const url = `${appUrl()}${path}`;
  const spec = INVITE_ROLES[invite.role];
  const event = invite.eventTitle ?? "an iCFO event";
  const asks = asksFor(invite.role);
  const due = invite.materialsDue
    ? new Date(`${invite.materialsDue}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "long" })
    : null;

  const subject = `You're invited to ${event}`;
  const note = invite.note?.trim()
    ? `<blockquote style="margin:14px 0;padding-left:12px;border-left:3px solid #C7D2FE;color:#475569">${escapeHtml(invite.note.trim())}</blockquote>`
    : "";

  const askLine = asks
    ? `<p>We'll need ${asks}${due ? ` by <b>${due}</b>` : ""}. You can add them from the same page.</p>`
    : "";

  const html =
    `<p>Hi ${escapeHtml(firstName(invite))},</p>` +
    `<p>You're invited to take part in <b>${escapeHtml(event)}</b> as a <b>${spec.label}</b>.</p>` +
    note +
    `<p><a href="${url}">Accept or decline →</a></p>` +
    askLine +
    FOOTER;

  const text =
    `Hi ${firstName(invite)}, you're invited to ${event} as a ${spec.label}. ` +
    `Accept or decline: ${url}.` +
    (asks ? ` We'll need ${asks}${due ? ` by ${due}` : ""}.` : "");

  return sendEmail({ to: invite.email, subject, html, text, fromName: "iCapOS" });
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
  const url = `${appUrl()}${path}`;
  const event = invite.eventTitle ?? "your iCFO event";
  const due = invite.materialsDue
    ? new Date(`${invite.materialsDue}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "long" })
    : null;

  const list = outstanding.map((o) => `<li>${escapeHtml(o)}</li>`).join("");
  const subject = `Still needed for ${event}: ${outstanding.join(" and ").toLowerCase()}`;

  const html =
    `<p>Hi ${escapeHtml(firstName(invite))},</p>` +
    `<p>You're confirmed for <b>${escapeHtml(event)}</b>. We're still waiting on:</p>` +
    `<ul>${list}</ul>` +
    (due ? `<p>Due <b>${due}</b>.</p>` : "") +
    `<p><a href="${url}">Add them now →</a></p>` +
    `<p style="color:#667;font-size:12px">This stops automatically once everything is in.</p>` +
    FOOTER;

  const text =
    `Hi ${firstName(invite)}, still needed for ${event}: ${outstanding.join(", ")}.` +
    (due ? ` Due ${due}.` : "") +
    ` Add them: ${url}`;

  return sendEmail({ to: invite.email, subject, html, text, fromName: "iCapOS" });
}
