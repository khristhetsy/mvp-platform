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

export type Recipient = { name: string; company: string | null };

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

/** The variables both templates are given. */
export function introVars(input: {
  investor: Recipient;
  founder: Recipient;
  eventTitle: string;
  sharedSectors: string[];
}): Record<string, string> {
  const shared = input.sharedSectors.filter(Boolean);
  return {
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
