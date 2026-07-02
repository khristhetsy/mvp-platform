/**
 * Email templates and senders for deal room activity.
 * Each function sends a transactional email to the founder
 * when an investor takes a meaningful action in their deal room.
 */

import { sendEmail } from "@/lib/email/send-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserLocale, getUserLocaleByEmail } from "@/lib/i18n/user-locale";
import { emailTranslator, type EmailT } from "@/lib/i18n/email-i18n";

const ACCENT = "#2E78F5";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

// ── Shared HTML wrapper ───────────────────────────────────────────────────────

function emailShell(content: string, t: EmailT): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>iCapOS</title>
</head>
<body style="margin:0;padding:0;background:#F8F9FC;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FC;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:580px;background:white;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background:${ACCENT};padding:24px 32px;">
              <span style="font-size:18px;font-weight:800;color:white;letter-spacing:-0.02em;">iCapOS</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f3f4f6;background:#fafafa;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                ${t("shell.footerFounder")}
                <a href="${APP_URL}/founder/settings" style="color:${ACCENT};">${t("shell.manage")}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;background:${ACCENT};color:white;font-size:14px;font-weight:600;padding:11px 24px;border-radius:10px;text-decoration:none;">${label} →</a>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getFounderEmail(founderId: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", founderId)
    .maybeSingle();
  return data?.email ?? null;
}

async function getInvestorName(investorId: string): Promise<string> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", investorId)
    .maybeSingle();
  return data?.full_name ?? data?.email ?? "An investor";
}

// ── Email senders ─────────────────────────────────────────────────────────────

export async function emailFounderDealRoomQuestion(input: {
  founderId: string;
  investorId: string;
  roomId: string;
  roomTitle: string;
  questionCategory: string;
}) {
  const [founderEmail, investorName, locale] = await Promise.all([
    getFounderEmail(input.founderId),
    getInvestorName(input.investorId),
    getUserLocale(input.founderId),
  ]);
  if (!founderEmail) return;
  const t = emailTranslator(locale);

  const deepLink = `${APP_URL}/founder/deal-room/${input.roomId}`;
  const html = emailShell(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;">${t("dealRoom.eyebrowActivity")}</p>
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">${t("dealRoom.question.heading")}</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      ${t("dealRoom.question.body", { investor: investorName, category: input.questionCategory, room: input.roomTitle })}
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      ${t("dealRoom.question.tip")}
    </p>
    ${ctaButton(t("dealRoom.question.cta"), deepLink)}
  `, t);

  await sendEmail({
    to: founderEmail,
    subject: t("dealRoom.question.subject", { room: input.roomTitle }),
    html,
    text: t("dealRoom.question.text", { investor: investorName, category: input.questionCategory, room: input.roomTitle, link: deepLink }),
  });
}

export async function emailFounderDocumentRequested(input: {
  founderId: string;
  investorId: string;
  roomId: string;
  roomTitle: string;
  documentLabel: string;
}) {
  const [founderEmail, investorName, locale] = await Promise.all([
    getFounderEmail(input.founderId),
    getInvestorName(input.investorId),
    getUserLocale(input.founderId),
  ]);
  if (!founderEmail) return;
  const t = emailTranslator(locale);

  const deepLink = `${APP_URL}/founder/deal-room/${input.roomId}`;
  const html = emailShell(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;">${t("dealRoom.eyebrowActivity")}</p>
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">${t("dealRoom.document.heading")}</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      ${t("dealRoom.document.body", { investor: investorName, document: input.documentLabel, room: input.roomTitle })}
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      ${t("dealRoom.document.tip")}
    </p>
    ${ctaButton(t("dealRoom.document.cta"), deepLink)}
  `, t);

  await sendEmail({
    to: founderEmail,
    subject: t("dealRoom.document.subject", { room: input.roomTitle }),
    html,
    text: t("dealRoom.document.text", { investor: investorName, document: input.documentLabel, room: input.roomTitle, link: deepLink }),
  });
}

export async function emailFounderRoomViewed(input: {
  founderId: string;
  investorId: string;
  roomId: string;
  roomTitle: string;
}) {
  const [founderEmail, investorName, locale] = await Promise.all([
    getFounderEmail(input.founderId),
    getInvestorName(input.investorId),
    getUserLocale(input.founderId),
  ]);
  if (!founderEmail) return;
  const t = emailTranslator(locale);

  const deepLink = `${APP_URL}/founder/deal-room/${input.roomId}`;
  const html = emailShell(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;">${t("dealRoom.eyebrowActivity")}</p>
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">${t("dealRoom.viewed.heading")}</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      ${t("dealRoom.viewed.body", { investor: investorName, room: input.roomTitle })}
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      ${t("dealRoom.viewed.tip")}
    </p>
    ${ctaButton(t("dealRoom.viewed.cta"), deepLink)}
  `, t);

  await sendEmail({
    to: founderEmail,
    subject: t("dealRoom.viewed.subject", { room: input.roomTitle }),
    html,
    text: t("dealRoom.viewed.text", { investor: investorName, room: input.roomTitle, link: deepLink }),
  });
}

export async function emailFounderInvestorInterest(input: {
  founderId: string;
  investorId: string;
  companyName: string;
}) {
  const [founderEmail, investorName, locale] = await Promise.all([
    getFounderEmail(input.founderId),
    getInvestorName(input.investorId),
    getUserLocale(input.founderId),
  ]);
  if (!founderEmail) return;
  const t = emailTranslator(locale);

  const deepLink = `${APP_URL}/founder/capital-raise`;
  const html = emailShell(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;">${t("dealRoom.eyebrowInvestorActivity")}</p>
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">${t("dealRoom.interest.heading")}</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      ${t("dealRoom.interest.body", { investor: investorName, company: input.companyName })}
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      ${t("dealRoom.interest.tip")}
    </p>
    ${ctaButton(t("dealRoom.interest.cta"), deepLink)}
  `, t);

  await sendEmail({
    to: founderEmail,
    subject: t("dealRoom.interest.subject", { company: input.companyName }),
    html,
    text: t("dealRoom.interest.text", { investor: investorName, company: input.companyName, link: deepLink }),
  });
}

export async function emailTeamInvite(input: {
  inviteeEmail: string;
  inviterName: string;
  companyName: string;
  inviteToken: string;
}) {
  // Invitees may not have an account yet — fall back to their saved locale if
  // one exists, otherwise English.
  const locale = await getUserLocaleByEmail(input.inviteeEmail);
  const t = emailTranslator(locale);
  const acceptUrl = `${APP_URL}/invite/accept?token=${input.inviteToken}`;
  const html = emailShell(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;">${t("dealRoom.teamInvite.eyebrow")}</p>
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">${t("dealRoom.teamInvite.heading", { company: input.companyName })}</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      ${t("dealRoom.teamInvite.body", { inviter: input.inviterName, company: input.companyName })}
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
      ${t("dealRoom.teamInvite.body2")}
    </p>
    ${ctaButton(t("dealRoom.teamInvite.cta"), acceptUrl)}
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">${t("dealRoom.teamInvite.expiry")}</p>
  `, t);

  await sendEmail({
    to: input.inviteeEmail,
    subject: t("dealRoom.teamInvite.subject", { company: input.companyName }),
    html,
    text: t("dealRoom.teamInvite.text", { inviter: input.inviterName, company: input.companyName, link: acceptUrl }),
  });
}
