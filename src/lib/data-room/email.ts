// Transactional "finish your data room" email. Best-effort: sendEmail no-ops
// without RESEND_API_KEY, so callers can fire-and-forget. Reused by the admin
// one-click nudge and the scheduled escalation cadence.

import { sendEmail } from "@/lib/email/send-email";
import type { DataRoomState } from "@/lib/data-room/completeness";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.capitalos.io").replace(/\/$/, "");
}

export function buildDataRoomReminderEmail(input: {
  founderName: string | null;
  companyName: string;
  state: DataRoomState;
}): { subject: string; html: string; text: string } {
  const { founderName, companyName, state } = input;
  const name = founderName?.split(" ")[0] || "there";
  const link = `${appUrl()}/founder/readiness/data-room`;

  const missing = state.coreMissing.length > 0 ? state.coreMissing : state.items.filter((i) => i.status === "missing");
  const missingLabels = missing.map((i) => i.label);

  const headline = state.coreComplete
    ? `Your data room is ${state.percent}% complete`
    : `Investors can't see ${companyName} yet`;

  const lead = state.coreComplete
    ? `You're close — ${state.missingCount} document${state.missingCount === 1 ? "" : "s"} left for a full diligence package.`
    : `Your investor-access essentials aren't in yet. Until they are, your company can't be listed to investors or request introductions.`;

  const listItems = missingLabels.map((l) => `<li style="margin:4px 0;">${l}</li>`).join("");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
    <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#534AB7;font-weight:600;margin:0 0 6px;">Due diligence</p>
    <h1 style="font-size:20px;margin:0 0 10px;">${headline}</h1>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 14px;">Hi ${name}, ${lead}</p>
    ${missingLabels.length ? `<p style="font-size:14px;color:#334155;margin:0 0 6px;font-weight:600;">Still needed:</p><ul style="font-size:14px;color:#334155;margin:0 0 16px;padding-left:18px;">${listItems}</ul>` : ""}
    <a href="${link}" style="display:inline-block;background:#534AB7;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;">Complete your data room →</a>
    <p style="font-size:12px;color:#94a3b8;margin:18px 0 0;line-height:1.5;">Several of these can be generated in-app in minutes — including your business plan, financial model, and cap table. ${state.percent}% complete (${state.completed}/${state.total}).</p>
  </div>`;

  const text = `${headline}\n\nHi ${name}, ${lead}\n\n${missingLabels.length ? `Still needed: ${missingLabels.join(", ")}\n\n` : ""}Complete your data room: ${link}`;

  return { subject: state.coreComplete ? `${companyName}: ${state.missingCount} document(s) from a complete data room` : `Action needed: complete your data room for ${companyName}`, html, text };
}

export async function sendDataRoomReminderEmail(input: {
  to: string;
  founderName: string | null;
  companyName: string;
  state: DataRoomState;
}): Promise<boolean> {
  const { subject, html, text } = buildDataRoomReminderEmail(input);
  return sendEmail({ to: input.to, subject, html, text });
}
