/**
 * Builds the email the sales AI agent proposes.
 *
 * The prospect's words are quoted verbatim (never paraphrased), the value
 * statements come only from the founder brochure and carry no figures, and the
 * email ends with one closing question and the link to the chosen agent's chat.
 * Everything written in the agent's own voice is fixed text here, so it can be
 * checked by `draftViolations` in tests rather than trusted at run time.
 */
import { CLOSING_QUESTION } from "./objection";
import type { DraftParts, Objection } from "./types";

export type DraftFacts = {
  firstName: string | null;
  asked: string | null;
  concern: string | null;
  objection: Objection;
  chatUrl: string | null;
  includeRefundOffer: boolean;
};

const BASE_VALUE =
  "Your Capital Readiness Rating shows the checklist investors use before a first meeting, and matching puts your company in front of investors that fit.";

const VALUE: Record<Objection, string> = {
  value: `${BASE_VALUE} Every plan includes every tool, including the Investor Relations Agent.`,
  money: `${BASE_VALUE} Plans are monthly and cancel any time.`,
  timing: BASE_VALUE,
  team: `${BASE_VALUE} I am glad to answer any questions your team has.`,
  fence: BASE_VALUE,
  ready: "Everything you need to get started is ready.",
  unknown: BASE_VALUE,
};

export const BRIDGE: Record<Objection, string> = {
  value: "Here is what it does for a company at your stage.",
  money: "That is a fair concern.",
  timing: "Timing depends on where your rating starts, so I would rather show you than guess.",
  team: "That makes sense. Your team will want the facts.",
  fence: "Take the time you need. Here is what matters most.",
  ready: "Good. Here is the next step.",
  unknown: "Thank you for your interest.",
};

export const REFUND_OFFER = "If your Capital Readiness Rating does not improve, we will refund your money.";
const LINK_PROMPT = " Click the link below to answer and our assistant will pick it up from there.";

/** A quote goes into the email on one line, inside straight quotes. */
export function cleanQuote(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/["“”]/g, "'").trim().slice(0, 220);
}

export function buildParts(f: DraftFacts): DraftParts {
  const intro: DraftParts["intro"] = [];
  if (f.asked) intro.push({ text: `You asked: "${cleanQuote(f.asked)}"`, quote: true });
  if (f.concern) intro.push({ text: `${f.asked ? "You also wrote" : "You wrote"}: "${cleanQuote(f.concern)}"`, quote: true });
  intro.push({ text: BRIDGE[f.objection], quote: false });
  return {
    greeting: f.firstName ? `Hi ${f.firstName},` : "Hello,",
    intro,
    value: VALUE[f.objection],
    refund: f.includeRefundOffer ? REFUND_OFFER : null,
    question: `${CLOSING_QUESTION[f.objection]}${f.chatUrl ? LINK_PROMPT : ""}`,
    link: f.chatUrl ? `Click here to respond: ${f.chatUrl}` : null,
  };
}

/** Same draft with the refund offer switched on or off. */
export function withRefund(p: DraftParts, include: boolean, line: string = REFUND_OFFER): DraftParts {
  return { ...p, refund: include ? line : null };
}

export type FollowUpFacts = { firstName: string | null; objection: Objection; chatUrl: string | null; includeRefundOffer: boolean };

/**
 * The email after a meeting. It thanks them, answers what the person's notes say
 * was raised, and ends with the same closing question and chat link. The meeting
 * notes are the person's own words, so nothing from them is quoted to the prospect.
 */
export function buildFollowUpParts(f: FollowUpFacts): DraftParts {
  return {
    greeting: f.firstName ? `Hi ${f.firstName},` : "Hello,",
    intro: [
      { text: "Thank you for the time today.", quote: false },
      { text: BRIDGE[f.objection], quote: false },
    ],
    value: VALUE[f.objection],
    refund: f.includeRefundOffer ? REFUND_OFFER : null,
    question: `${CLOSING_QUESTION[f.objection]}${f.chatUrl ? LINK_PROMPT : ""}`,
    link: f.chatUrl ? `Click here to respond: ${f.chatUrl}` : null,
  };
}

/** Plain text body. The sender's saved signature is added by the send route. */
export function renderBody(p: DraftParts): string {
  const blocks = [p.greeting, p.intro.map((l) => l.text).join("\n"), p.value];
  if (p.refund) blocks.push(p.refund);
  blocks.push(p.question);
  if (p.link) blocks.push(p.link);
  return blocks.join("\n\n");
}

/** Only the agent's own written lines, for the guard check. Quotes and the link are left out. */
export function writtenText(p: DraftParts): string {
  return [p.greeting, ...p.intro.filter((l) => !l.quote).map((l) => l.text), p.value, p.refund ?? "", p.question].join("\n");
}

export function subjectFor(opportunityTitle: string, lastSubject?: string | null): string {
  const last = (lastSubject ?? "").trim();
  if (last) return /^re:/i.test(last) ? last : `Re: ${last}`;
  const title = opportunityTitle.trim();
  return title ? `Following up: ${title}` : "Following up";
}
