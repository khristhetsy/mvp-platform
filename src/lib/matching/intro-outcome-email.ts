/**
 * What a founder is told when iCFO acts on an introduction they requested.
 * Pure. The investor is described by type only; names and contact details stay
 * with iCFO until the introduction is made.
 */
import { button, escapeHtml, shell } from "@/lib/activity/email-templates";

export type IntroOutcome = "facilitated" | "contacted" | "declined";

export type IntroOutcomeInput = {
  outcome: IntroOutcome;
  firstName: string | null;
  companyName: string;
  investorLabel: string;
  note: string | null;
  matchesUrl: string;
};

export function introOutcomeCopy(input: IntroOutcomeInput): { title: string; message: string } {
  const who = input.investorLabel.toLowerCase();
  switch (input.outcome) {
    case "facilitated":
      return {
        title: "Your introduction is set up",
        message: `iCFO introduced ${input.companyName} to the ${who} you requested. Expect to hear from them directly.`,
      };
    case "contacted":
      return {
        title: "iCFO reached out for you",
        message: `iCFO contacted the ${who} you requested on behalf of ${input.companyName}. We will update you when they respond.`,
      };
    case "declined":
      return {
        title: "Introduction not made",
        message: `iCFO reviewed your request to meet the ${who} and did not make this introduction. You can request a different match from your matches page.`,
      };
  }
}

export function renderIntroOutcomeEmail(input: IntroOutcomeInput): { subject: string; text: string; html: string } {
  const { title, message } = introOutcomeCopy(input);
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const note = input.note?.trim() || null;
  const text = [greeting, "", message, note ? `\nNote from iCFO: ${note}` : null, "", `Your matches: ${input.matchesUrl}`]
    .filter((l): l is string => l !== null)
    .join("\n");
  const html = shell(
    `<div style="font-size:18px;font-weight:bold;margin:0 0 12px;">${escapeHtml(title)}</div>` +
      `<p style="margin:0 0 14px;">${escapeHtml(greeting)} ${escapeHtml(message)}</p>` +
      (note
        ? `<div style="background:#F4F6FB;border-radius:8px;padding:10px 12px;font-size:13px;margin:0 0 16px;">Note from iCFO: ${escapeHtml(note)}</div>`
        : "") +
      `<div>${button("See your matches", input.matchesUrl, true)}</div>`,
  );
  return { subject: `${title} · ${input.companyName}`, text, html };
}
