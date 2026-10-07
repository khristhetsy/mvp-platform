// Delivery channels: in-app (DB row), email (Resend), push (deferred stub).

import { sendEmail } from "@/lib/email/send-email";
import { insertNotification } from "./store";
import { appOrigin } from "@/lib/activity/email-templates";
import { renderEmail } from "@/lib/email/layout";

// Same origin helper every other email uses. Production sets NEXT_PUBLIC_SITE_URL, not
// NEXT_PUBLIC_APP_URL, and app.icapos.com is not a live domain (DEPLOYMENT_NOT_FOUND).
const APP_URL = appOrigin();

export interface DeliveryPayload {
  adminId: string;
  typeId: string;
  title: string;
  body: string;
  link?: string;
  meta?: Record<string, unknown>;
  dedupeKey?: string;
  toEmail?: string;
}

/** Write the in-app feed row. Returns false if deduped. */
export async function deliverInApp(p: DeliveryPayload): Promise<boolean> {
  return insertNotification({
    adminId: p.adminId,
    typeId: p.typeId,
    title: p.title,
    body: p.body,
    link: p.link,
    meta: p.meta,
    dedupeKey: p.dedupeKey,
  });
}

function emailHtml(p: DeliveryPayload): string {
  const url = p.link ? (p.link.startsWith("http") ? p.link : `${APP_URL}${p.link}`) : `${APP_URL}/admin/marketing`;
  return renderEmail({
    audience: "admin",
    subject: p.title,
    preheader: p.body,
    context: "Marketing",
    eyebrow: "Marketing",
    headline: p.title,
    intro: p.body,
    primary: { label: "Open in iCapOS", url },
    footer: { reason: "Internal. You can change what triggers these emails in Marketing, Settings, Notifications." },
  }).html;
}

/** Send the email channel via Resend. Best-effort — never throws into emit(). */
export async function deliverEmail(p: DeliveryPayload): Promise<boolean> {
  if (!p.toEmail) return false;
  try {
    return await sendEmail({
      to: p.toEmail,
      subject: p.title,
      html: emailHtml(p),
      text: `${p.title}\n\n${p.body}`,
      fromName: "iCapOS Ops",
    });
  } catch {
    return false;
  }
}

/**
 * Push channel — DEFERRED. Mobile push wakeup (CallKit/PushKit, ConnectionService)
 * is a separate infra track. This is intentionally a no-op so the channel can be
 * toggled in the UI ("coming soon") without doing anything yet.
 */
export async function deliverPush(p: DeliveryPayload): Promise<boolean> {
  void p; // deferred — intentionally does nothing yet
  return false;
}

export const PUSH_ENABLED = false;
