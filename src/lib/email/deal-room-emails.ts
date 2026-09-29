/**
 * Email templates and senders for deal room activity.
 * Each function sends a transactional email to the founder
 * when an investor takes a meaningful action in their deal room.
 */

import { sendEmail } from "@/lib/email/send-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getUserLocale, getUserLocaleByEmail } from "@/lib/i18n/user-locale";
import { emailTranslator, type EmailT } from "@/lib/i18n/email-i18n";
import { esc, renderEmail } from "@/lib/email/layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com";

/** Values go into translated strings that carry their own <strong> markup. */
function escVars(vars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, esc(v)]));
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** One deal room email on the shared layout. Pure. */
export function buildDealRoomEmail(
  t: EmailT,
  input: {
    subject: string;
    eyebrow: string;
    heading: string;
    /** Translation key of the body; its values are escaped before insertion. */
    bodyKey: string;
    vars: Record<string, string>;
    tip?: string | null;
    cta: string;
    url: string;
    context?: string | null;
    footerReason?: string;
    note?: string | null;
  },
): { subject: string; html: string } {
  const bodyHtml = t(input.bodyKey, escVars(input.vars));
  return renderEmail({
    audience: "founder",
    subject: input.subject,
    preheader: plainText(t(input.bodyKey, input.vars)),
    context: input.context ?? null,
    eyebrow: input.eyebrow,
    headline: input.heading,
    blocks: [
      { type: "html", html: `<p style="margin:0;font-size:15px;line-height:24px;color:#16223F;">${bodyHtml}</p>` },
      ...(input.tip ? [{ type: "paragraph" as const, text: input.tip }] : []),
      ...(input.note ? [{ type: "note" as const, text: input.note }] : []),
    ],
    primary: { label: input.cta, url: input.url },
    footer: {
      reason: input.footerReason ?? t("shell.footerFounder"),
      preferencesUrl: input.footerReason ? null : `${APP_URL}/founder/settings`,
      preferencesLabel: t("shell.manage"),
      lines: [t("diligence.notBrokerDealer")],
    },
  });
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
  const { html } = buildDealRoomEmail(t, {
    subject: t("dealRoom.question.subject", { room: input.roomTitle }),
    eyebrow: t("dealRoom.eyebrowActivity"),
    heading: t("dealRoom.question.heading"),
    bodyKey: "dealRoom.question.body",
    vars: { investor: investorName, category: input.questionCategory, room: input.roomTitle },
    tip: null,
    cta: t("dealRoom.question.cta"),
    url: deepLink,
    context: input.roomTitle,
  });

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
  const { html } = buildDealRoomEmail(t, {
    subject: t("dealRoom.document.subject", { room: input.roomTitle }),
    eyebrow: t("dealRoom.eyebrowActivity"),
    heading: t("dealRoom.document.heading"),
    bodyKey: "dealRoom.document.body",
    vars: { investor: investorName, document: input.documentLabel, room: input.roomTitle },
    tip: t("dealRoom.document.tip"),
    cta: t("dealRoom.document.cta"),
    url: deepLink,
    context: input.roomTitle,
  });

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
  const { html } = buildDealRoomEmail(t, {
    subject: t("dealRoom.viewed.subject", { room: input.roomTitle }),
    eyebrow: t("dealRoom.eyebrowActivity"),
    heading: t("dealRoom.viewed.heading"),
    bodyKey: "dealRoom.viewed.body",
    vars: { investor: investorName, room: input.roomTitle },
    tip: t("dealRoom.viewed.tip"),
    cta: t("dealRoom.viewed.cta"),
    url: deepLink,
    context: input.roomTitle,
  });

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
  const { html } = buildDealRoomEmail(t, {
    subject: t("dealRoom.interest.subject", { company: input.companyName }),
    eyebrow: t("dealRoom.eyebrowInvestorActivity"),
    heading: t("dealRoom.interest.heading"),
    bodyKey: "dealRoom.interest.body",
    vars: { investor: investorName, company: input.companyName },
    tip: t("dealRoom.interest.tip"),
    cta: t("dealRoom.interest.cta"),
    url: deepLink,
    context: input.companyName,
  });

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
  const { html } = buildDealRoomEmail(t, {
    subject: t("dealRoom.teamInvite.subject", { company: input.companyName }),
    eyebrow: t("dealRoom.teamInvite.eyebrow"),
    heading: t("dealRoom.teamInvite.heading", { company: input.companyName }),
    bodyKey: "dealRoom.teamInvite.body",
    vars: { inviter: input.inviterName, company: input.companyName },
    tip: t("dealRoom.teamInvite.body2"),
    cta: t("dealRoom.teamInvite.cta"),
    url: acceptUrl,
    context: input.companyName,
    footerReason: t("dealRoom.teamInvite.expiry"),
  });

  await sendEmail({
    to: input.inviteeEmail,
    subject: t("dealRoom.teamInvite.subject", { company: input.companyName }),
    html,
    text: t("dealRoom.teamInvite.text", { inviter: input.inviterName, company: input.companyName, link: acceptUrl }),
  });
}
