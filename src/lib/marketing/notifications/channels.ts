// Delivery channels: in-app (DB row), email (Resend), push (deferred stub).

import { sendEmail } from "@/lib/email/send-email";
import { insertNotification } from "./store";

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
  const safeTitle = escapeHtml(p.title);
  const safeBody = escapeHtml(p.body);
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f2147;">',
    '<div style="border-left:3px solid #2E78F5;padding:8px 16px;margin-bottom:16px;">',
    `<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#2E78F5;">Marketing hub</div>`,
    `<div style="font-size:18px;font-weight:bold;margin-top:4px;">${safeTitle}</div>`,
    "</div>",
    `<p style="font-size:14px;line-height:1.6;color:#334155;">${safeBody}</p>`,
    `<p style="margin-top:20px;"><a href="${url}" style="display:inline-block;background:#2E78F5;color:#fff;text-decoration:none;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:bold;">Open in the hub</a></p>`,
    '<p style="margin-top:24px;font-size:11px;color:#94a3b8;">You can change what triggers these emails in Marketing hub › Settings › Notifications.</p>',
    "</div>",
  ].join("");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
