/**
 * Wording for the founder introduction request log lines. Pure, so the copy is
 * testable and the same words land in account activity and on the contact
 * timeline.
 */

export type IntroInvestorKind = "prospect" | "member";

/** Prospect statuses (new, contacted, dismissed) and member statuses (reviewing, facilitated, declined). */
export type IntroHandledStatus = "new" | "contacted" | "dismissed" | "reviewing" | "facilitated" | "declined";

const VERB: Record<IntroHandledStatus, string> = {
  new: "moved back to new",
  contacted: "marked contacted",
  dismissed: "declined",
  reviewing: "marked in review",
  facilitated: "marked introduced",
  declined: "declined",
};

/** Account activity title, e.g. "Intro to Tarra Sharp marked contacted". */
export function introHandledTitle(status: IntroHandledStatus, investorName: string): string {
  return `Intro to ${investorName} ${VERB[status]}`;
}

/** Contact timeline line when a founder asks for an intro to this investor. */
export function introRequestedSummary(companyName: string): string {
  return `Intro requested by ${companyName}`;
}

/** Contact timeline line when staff act on the request. */
export function introHandledSummary(status: IntroHandledStatus, companyName: string): string {
  switch (status) {
    case "contacted":
      return `Contacted for intro to ${companyName}`;
    case "facilitated":
      return `Introduced to ${companyName}`;
    case "reviewing":
      return `Intro to ${companyName} in review`;
    case "dismissed":
    case "declined":
      return `Intro to ${companyName} declined`;
    case "new":
      return `Intro to ${companyName} moved back to new`;
  }
}
