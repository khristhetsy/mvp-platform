// Delivery channels: in-app (DB row), email (Resend), push (deferred stub).

import { sendEmail } from "@/lib/email/send-email";
import { insertNotification } from "./store";
import { renderEmail } from "@/lib/email/layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.icapos.com";

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
    context: "Marketing hub",
    eyebrow: "Marketing hub",
    headline: p.title,
    intro: p.body,
    primary: { label: "Open in the hub", url },
    footer: { reason: "Internal. You can change what triggers these emails in Marketing hub, Settings, Notifications." },
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
