/**
 * Introductions we send.
 *
 * The rules that decide who gets mailed, and how often, live here as pure
 * functions — "automatically" without a boundary is how a busy event sends a
 * few hundred unsolicited emails to people who already ignored one.
 *
 * The founder is the one pursuing: the invitation goes **to the investor**,
 * about the founder, and the follow-up chases the investor on the founder's
 * behalf.
 */

import { matchReason } from "@/lib/icfo-events/match-reason";

export const MAX_FOLLOW_UPS = 2;
export const FOLLOW_UP_AFTER_DAYS = 3;
/** Nothing is sent inside this window — an event is imminent, not a campaign. */
export const QUIET_HOURS_BEFORE_EVENT = 24;

export type IntroductionStatus = "sent" | "accepted" | "declined";

export type Introduction = {
  id: string;
  status: IntroductionStatus;
  sentAt: string;
  followUps: number;
  lastFollowUpAt: string | null;
};

const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;

export type FollowUpDecision =
  | { send: true }
  | { send: false; reason: string };

/**
 * Whether to chase this introduction now.
 *
 * Every "no" carries its reason, because a silent skip is indistinguishable
 * from a broken job — and this one runs unattended.
 */
export function shouldFollowUp(
  intro: Introduction,
  opts: { now?: Date; eventStartsAt?: string | null } = {},
): FollowUpDecision {
  const now = opts.now ?? new Date();

  if (intro.status === "accepted") return { send: false, reason: "already accepted" };
  if (intro.status === "declined") return { send: false, reason: "declined — never chased" };
  if (intro.followUps >= MAX_FOLLOW_UPS) {
    return { send: false, reason: `already followed up ${intro.followUps} times` };
  }

  if (opts.eventStartsAt) {
    const starts = new Date(opts.eventStartsAt);
    const until = hoursBetween(now, starts);
    // Past events are not chased either: the introduction had its chance.
    if (until < QUIET_HOURS_BEFORE_EVENT) {
      return { send: false, reason: `event is within ${QUIET_HOURS_BEFORE_EVENT}h` };
    }
  }

  const since = intro.lastFollowUpAt ?? intro.sentAt;
  const waited = hoursBetween(new Date(since), now);
  if (waited < FOLLOW_UP_AFTER_DAYS * 24) {
    return { send: false, reason: `only ${Math.floor(waited)}h since the last message` };
  }

  return { send: true };
}

export type Recipient = {
  name: string;
  company: string | null;
  /** Their place in the room, for the reason line when nothing is shared. */
  role?: "investor" | "founder" | "service" | "sponsor" | "presenter";
  /** From the founder's registration answers. Any of these may be missing. */
  pitch?: string | null;
  stage?: string | null;
  raising?: string | null;
  roundSize?: string | null;
};

/**
 * Fill a template.
 *
 * Unknown tokens are left alone rather than blanked: `{{whatever}}` showing up
 * in a test send is a visible mistake, an empty gap is not.
 */
export function renderTemplate(
  text: string,
  vars: Record<string, string | null | undefined>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    const v = vars[key];
    return v == null ? whole : v;
  });
}

/**
 * Fill a template and drop the lines that emptied.
 *
 * A token the writer mistyped stays visible — that is `renderTemplate`'s job.
 * A token that is simply unanswered is different: the founder who registered
 * before the pitch field existed has no pitch, and "runs Harvard MedTech — "
 * is worse than not mentioning it. So a line that had content before
 * substitution and none after is removed, and the blank lines between
 * paragraphs are left alone.
 */
export function renderBody(text: string, vars: Record<string, string | null | undefined>): string {
  return text
    .split("\n")
    .filter((line) => {
      if (!line.trim()) return true;
      return renderTemplate(line, vars).trim().length > 0;
    })
    .map((line) => renderTemplate(line, vars))
    .join("\n")
    // Three or more newlines can only come from a dropped paragraph.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The variables both templates are given. */
export function introVars(input: {
  investor: Recipient;
  founder: Recipient;
  eventTitle: string;
  sharedSectors: string[];
}): Record<string, string> {
  const shared = input.sharedSectors.filter(Boolean);
  // One line rather than three tokens, so a founder who answered none of them
  // loses the line instead of leaving " ·  · " behind.
  const stageLine = [input.founder.stage, input.founder.raising, input.founder.roundSize]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" · ");
  return {
    founder_pitch: (input.founder.pitch ?? "").trim(),
    founder_stage: (input.founder.stage ?? "").trim(),
    founder_raising: (input.founder.raising ?? "").trim(),
    founder_round: (input.founder.roundSize ?? "").trim(),
    founder_stage_line: stageLine,
    // Name and company as one phrase, so a founder with no company on file
    // reads as "Shan Padda" rather than "Shan Padda — ".
    founder_line: [input.founder.name, (input.founder.company ?? "").trim()].filter(Boolean).join(" — "),
    investor_line: [input.investor.name, (input.investor.company ?? "").trim()].filter(Boolean).join(" — "),
    first_name: input.investor.name.split(/\s+/)[0] || input.investor.name,
    investor_name: input.investor.name,
    investor_company: input.investor.company ?? "",
    founder_name: input.founder.name,
    founder_company: input.founder.company ?? "their company",
    event_title: input.eventTitle,
    // A sentence fragment, so the copy reads correctly when nothing is shared
    // rather than trailing "and you share ".
    shared_line: shared.length ? `, and you share ${shared.join(", ")}` : "",
    shared_sectors: shared.join(", "),
    // The same line the digest rows carry, so one match cannot be explained
    // two different ways depending on how it was delivered.
    match_reason: matchReason({ sharedSectors: shared, role: input.founder.role ?? "founder" }),
  };
}

export type SendPlan = {
  /** One email per investor, however many founders they matched. */
  perRecipient: { investorRegId: string; introductionIds: string[] }[];
  /** Investors who would otherwise get more than one email. */
  wouldRepeat: number;
};

/**
 * Group a bulk send by recipient.
 *
 * An investor matched to six founders would otherwise receive six separate
 * emails from us on the same morning, which reads as spam whatever each one
 * says. The caller uses this to offer a single digest instead.
 */
export function planBulkSend(pairs: { investorRegId: string; introductionId: string }[]): SendPlan {
  const byInvestor = new Map<string, string[]>();
  for (const p of pairs) {
    byInvestor.set(p.investorRegId, [...(byInvestor.get(p.investorRegId) ?? []), p.introductionId]);
  }
  return {
    perRecipient: [...byInvestor].map(([investorRegId, introductionIds]) => ({ investorRegId, introductionIds })),
    wouldRepeat: [...byInvestor.values()].filter((ids) => ids.length > 1).length,
  };
}

/**
 * Chasing the founder for a time.
 *
 * The scheduling step created a new way for an introduction to stall: the
 * investor said yes and is waiting on somebody who has not come back. That is
 * worse than an unanswered invitation — somebody is expecting a meeting — so
 * the founder is chased sooner, and still not forever.
 */
export const MAX_FOUNDER_REMINDERS = 2;
export const REMIND_FOUNDER_AFTER_HOURS = 24;

export type FounderChase = {
  status: IntroductionStatus;
  /** Null until the founder picks a slot. */
  scheduledAt: string | null;
  respondedAt: string | null;
  sentAt: string;
  founderReminders: number;
  lastFounderReminderAt: string | null;
};

export function shouldRemindFounder(
  intro: FounderChase,
  opts: { now?: Date; eventStartsAt?: string | null } = {},
): FollowUpDecision {
  const now = opts.now ?? new Date();

  if (intro.status !== "accepted") return { send: false, reason: "not accepted" };
  if (intro.scheduledAt) return { send: false, reason: "already scheduled" };
  if (intro.founderReminders >= MAX_FOUNDER_REMINDERS) {
    return { send: false, reason: `already reminded ${intro.founderReminders} times` };
  }

  // Once the event has started there is no slot left to give, so chasing for
  // one is just noise.
  if (opts.eventStartsAt && new Date(opts.eventStartsAt).getTime() <= now.getTime()) {
    return { send: false, reason: "event has started" };
  }

  const since = intro.lastFounderReminderAt ?? intro.respondedAt ?? intro.sentAt;
  const waited = hoursBetween(new Date(since), now);
  if (waited < REMIND_FOUNDER_AFTER_HOURS) {
    return { send: false, reason: `only ${Math.floor(waited)}h since the last message` };
  }
  return { send: true };
}
