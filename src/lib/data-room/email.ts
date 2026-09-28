// Transactional "finish your data room" email. Best-effort: sendEmail no-ops
// without RESEND_API_KEY, so callers can fire-and-forget. Reused by the admin
// one-click nudge and the scheduled escalation cadence. Localized per recipient.

import { sendEmail } from "@/lib/email/send-email";
import { getUserLocaleByEmail } from "@/lib/i18n/user-locale";
import { emailTranslator } from "@/lib/i18n/email-i18n";
import type { AppLocale } from "@/lib/i18n/locale";
import type { DataRoomState } from "@/lib/data-room/completeness";
import { renderEmail } from "@/lib/email/layout";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
}

export function buildDataRoomReminderEmail(input: {
  founderName: string | null;
  companyName: string;
  state: DataRoomState;
  locale?: AppLocale;
}): { subject: string; html: string; text: string } {
  const { founderName, companyName, state } = input;
  const t = emailTranslator(input.locale ?? "en");
  const name = founderName?.split(" ")[0] || "there";
  const link = `${appUrl()}/founder/readiness/data-room`;
  const docs = t(state.missingCount === 1 ? "dataRoom.docSingular" : "dataRoom.docPlural");

  const missing = state.coreMissing.length > 0 ? state.coreMissing : state.items.filter((i) => i.status === "missing");
  const missingLabels = missing.map((i) => i.label);

  const headline = state.coreComplete
    ? t("dataRoom.headlineComplete", { percent: state.percent })
    : t("dataRoom.headlineIncomplete", { company: companyName });

  const lead = state.coreComplete
    ? t("dataRoom.leadComplete", { count: state.missingCount, docs })
    : t("dataRoom.leadIncomplete");

  const greeting = t("dataRoom.greeting", { name });
  const subject = state.coreComplete
    ? t("dataRoom.subjectComplete", { company: companyName, count: state.missingCount, docs })
    : t("dataRoom.subjectIncomplete", { company: companyName });
  const note = t("dataRoom.note", { percent: state.percent, completed: state.completed, total: state.total });

  const mail = renderEmail({
    audience: "founder",
    subject,
    preheader: lead,
    context: companyName,
    eyebrow: t("dataRoom.eyebrow"),
    headline,
    intro: `${greeting} ${lead}`,
    blocks: [
      { type: "progress", label: t("dataRoom.eyebrow"), value: `${state.completed}/${state.total} · ${state.percent}%`, percent: state.percent },
      ...(missingLabels.length
        ? [{ type: "checklist" as const, title: t("dataRoom.stillNeeded"), items: missingLabels.map((label) => ({ label, done: false })) }]
        : []),
      { type: "paragraph", text: note },
    ],
    primary: { label: t("dataRoom.cta").replace(/\s*→\s*$/, ""), url: link },
    footer: {
      reason: t("shell.footerFounder"),
      preferencesUrl: `${appUrl()}/founder/settings`,
      preferencesLabel: t("shell.manage"),
      lines: [t("diligence.notBrokerDealer")],
    },
  });

  const text = `${headline}\n\n${greeting} ${lead}\n\n${missingLabels.length ? `${t("dataRoom.stillNeeded")} ${missingLabels.join(", ")}\n\n` : ""}${t("dataRoom.cta")} ${link}`;

  return { subject, html: mail.html, text };
}

export async function sendDataRoomReminderEmail(input: {
  to: string;
  founderName: string | null;
  companyName: string;
  state: DataRoomState;
  locale?: AppLocale;
}): Promise<boolean> {
  // Resolve the recipient's saved language unless the caller already passed one.
  const locale = input.locale ?? (await getUserLocaleByEmail(input.to));
  const { subject, html, text } = buildDataRoomReminderEmail({ ...input, locale });
  return sendEmail({ to: input.to, subject, html, text, fromName: "iCapOS" });
}
