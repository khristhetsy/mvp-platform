/**
 * Email templates and senders for deal room activity.
 * Each function sends a transactional email to the founder
 * when an investor takes a meaningful action in their deal room.
 */

import { sendEmail } from "@/lib/email/send-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const ACCENT = "#534AB7";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.capitalos.io";

// ── Shared HTML wrapper ───────────────────────────────────────────────────────

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>CapitalOS</title>
</head>
<body style="margin:0;padding:0;background:#F8F9FC;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FC;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:580px;background:white;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background:${ACCENT};padding:24px 32px;">
              <span style="font-size:18px;font-weight:800;color:white;letter-spacing:-0.02em;">CapitalOS</span>
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
                You are receiving this because you have an active company on CapitalOS.
                <a href="${APP_URL}/founder/settings" style="color:${ACCENT};">Manage email preferences</a>
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
  const [founderEmail, investorName] = await Promise.all([
    getFounderEmail(input.founderId),
    getInvestorName(input.investorId),
  ]);
  if (!founderEmail) return;

  const deepLink = `${APP_URL}/founder/deal-room/${input.roomId}`;
  const html = emailShell(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;">Deal room activity</p>
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">New investor question</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${investorName}</strong> has asked a new <strong>${input.questionCategory}</strong> question in your deal room
      <strong>&ldquo;${input.roomTitle}&rdquo;</strong>.
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      Investors who get fast, thorough responses are significantly more likely to move to the next stage. Respond within 24 hours for best results.
    </p>
    ${ctaButton("View & respond", deepLink)}
  `);

  await sendEmail({
    to: founderEmail,
    subject: `New investor question in "${input.roomTitle}"`,
    html,
    text: `${investorName} asked a new ${input.questionCategory} question in your deal room "${input.roomTitle}". View it here: ${deepLink}`,
  });
}

export async function emailFounderDocumentRequested(input: {
  founderId: string;
  investorId: string;
  roomId: string;
  roomTitle: string;
  documentLabel: string;
}) {
  const [founderEmail, investorName] = await Promise.all([
    getFounderEmail(input.founderId),
    getInvestorName(input.investorId),
  ]);
  if (!founderEmail) return;

  const deepLink = `${APP_URL}/founder/deal-room/${input.roomId}`;
  const html = emailShell(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;">Deal room activity</p>
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">Document requested</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${investorName}</strong> has requested a document (<strong>${input.documentLabel}</strong>) in your deal room
      <strong>&ldquo;${input.roomTitle}&rdquo;</strong>.
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      Uploading requested documents quickly signals preparedness and builds investor confidence.
    </p>
    ${ctaButton("Upload document", deepLink)}
  `);

  await sendEmail({
    to: founderEmail,
    subject: `Document requested in "${input.roomTitle}"`,
    html,
    text: `${investorName} requested "${input.documentLabel}" in deal room "${input.roomTitle}". View it here: ${deepLink}`,
  });
}

export async function emailFounderRoomViewed(input: {
  founderId: string;
  investorId: string;
  roomId: string;
  roomTitle: string;
}) {
  const [founderEmail, investorName] = await Promise.all([
    getFounderEmail(input.founderId),
    getInvestorName(input.investorId),
  ]);
  if (!founderEmail) return;

  const deepLink = `${APP_URL}/founder/deal-room/${input.roomId}`;
  const html = emailShell(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;">Deal room activity</p>
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">Investor viewed your deal room</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${investorName}</strong> opened your deal room <strong>&ldquo;${input.roomTitle}&rdquo;</strong> for the first time.
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      Make sure all your documents are uploaded and any outstanding questions are answered — this is an active signal of investor interest.
    </p>
    ${ctaButton("Review deal room", deepLink)}
  `);

  await sendEmail({
    to: founderEmail,
    subject: `Investor viewed your deal room: "${input.roomTitle}"`,
    html,
    text: `${investorName} viewed your deal room "${input.roomTitle}". Review it here: ${deepLink}`,
  });
}

export async function emailFounderInvestorInterest(input: {
  founderId: string;
  investorId: string;
  companyName: string;
}) {
  const [founderEmail, investorName] = await Promise.all([
    getFounderEmail(input.founderId),
    getInvestorName(input.investorId),
  ]);
  if (!founderEmail) return;

  const deepLink = `${APP_URL}/founder/capital-raise`;
  const html = emailShell(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;">Investor activity</p>
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">New investor interest</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${investorName}</strong> has expressed interest in <strong>${input.companyName}</strong> on CapitalOS.
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
      This is an early signal. Log into your dashboard to review their profile and decide on next steps.
    </p>
    ${ctaButton("View capital raise", deepLink)}
  `);

  await sendEmail({
    to: founderEmail,
    subject: `New investor interest in ${input.companyName}`,
    html,
    text: `${investorName} expressed interest in ${input.companyName}. View it here: ${deepLink}`,
  });
}

export async function emailTeamInvite(input: {
  inviteeEmail: string;
  inviterName: string;
  companyName: string;
  inviteToken: string;
}) {
  const acceptUrl = `${APP_URL}/invite/accept?token=${input.inviteToken}`;
  const html = emailShell(`
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:.08em;">Team invitation</p>
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;">You&rsquo;ve been invited to join ${input.companyName}</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${input.inviterName}</strong> has invited you to join the <strong>${input.companyName}</strong> workspace on CapitalOS as a team member.
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
      As a team member you can collaborate on investor outreach, review deal rooms, and track fundraising progress alongside your co-founder.
    </p>
    ${ctaButton("Accept invitation", acceptUrl)}
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">This invitation expires in 7 days. If you didn&rsquo;t expect this email, you can safely ignore it.</p>
  `);

  await sendEmail({
    to: input.inviteeEmail,
    subject: `You're invited to join ${input.companyName} on CapitalOS`,
    html,
    text: `${input.inviterName} invited you to join ${input.companyName} on CapitalOS. Accept here: ${acceptUrl}`,
  });
}
