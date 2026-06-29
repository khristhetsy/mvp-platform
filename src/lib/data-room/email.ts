// Transactional "finish your data room" email. Best-effort: sendEmail no-ops
// without RESEND_API_KEY, so callers can fire-and-forget. Reused by the admin
// one-click nudge and the scheduled escalation cadence. Localized per recipient.

import { sendEmail } from "@/lib/email/send-email";
import { getUserLocaleByEmail } from "@/lib/i18n/user-locale";
import { emailTranslator } from "@/lib/i18n/email-i18n";
import type { AppLocale } from "@/lib/i18n/locale";
import type { DataRoomState } from "@/lib/data-room/completeness";

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
  const listItems = missingLabels.map((l) => `<li style="margin:4px 0;">${l}</li>`).join("");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
    <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#534AB7;font-weight:600;margin:0 0 6px;">${t("dataRoom.eyebrow")}</p>
    <h1 style="font-size:20px;margin:0 0 10px;">${headline}</h1>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 14px;">${greeting} ${lead}</p>
    ${missingLabels.length ? `<p style="font-size:14px;color:#334155;margin:0 0 6px;font-weight:600;">${t("dataRoom.stillNeeded")}</p><ul style="font-size:14px;color:#334155;margin:0 0 16px;padding-left:18px;">${listItems}</ul>` : ""}
    <a href="${link}" style="display:inline-block;background:#534AB7;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;">${t("dataRoom.cta")}</a>
    <p style="font-size:12px;color:#94a3b8;margin:18px 0 0;line-height:1.5;">${t("dataRoom.note", { percent: state.percent, completed: state.completed, total: state.total })}</p>
  </div>`;

  const text = `${headline}\n\n${greeting} ${lead}\n\n${missingLabels.length ? `${t("dataRoom.stillNeeded")} ${missingLabels.join(", ")}\n\n` : ""}${t("dataRoom.cta")} ${link}`;

  return {
    subject: state.coreComplete
      ? t("dataRoom.subjectComplete", { company: companyName, count: state.missingCount, docs })
      : t("dataRoom.subjectIncomplete", { company: companyName }),
    html,
    text,
  };
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
  return sendEmail({ to: input.to, subject, html, text });
}
