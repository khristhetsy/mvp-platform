import { button, escapeHtml, shell } from "@/lib/activity/email-templates";
import { NOT_A_BROKER_DEALER } from "@/lib/email/layout";

/** The email that carries the "create your login" link after a guest payment. Pure, so a test renders what production sends. */
export function renderPaidSignupEmail(input: { firstName: string | null; planLabel: string; loginUrl: string }): { subject: string; html: string; text: string } {
  const subject = "Payment received. Create your iCapOS login";
  const hello = input.firstName ? `Hi ${input.firstName},` : "Hello,";
  const body = `${hello} thank you, your ${input.planLabel} plan is paid. Create your login to open your workspace and start onboarding.`;
  const html = shell(
    `<p style="margin:0 0 14px;">${escapeHtml(body)}</p>${button("Create my login", input.loginUrl, true)}<p style="margin:14px 0 0;font-size:13px;">This link is private to you. If you have already created your login, just sign in.</p>`,
    { audience: "founder", subject, preheader: "Your plan is paid. One step left.", reason: "You are receiving this because you paid for an iCapOS plan.", lines: [NOT_A_BROKER_DEALER] },
  );
  return { subject, html, text: `${body}\n\nCreate my login: ${input.loginUrl}\n\nThis link is private to you. If you have already created your login, just sign in.` };
}
