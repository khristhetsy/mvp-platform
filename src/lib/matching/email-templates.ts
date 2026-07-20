// COUNSEL-REVIEWABLE FILE — matching lifecycle email copy.
//
// These emails are issuer/intermediary-adjacent communications. The strings below
// are PLACEHOLDERS and are NOT approved legal copy. Email delivery is disabled
// until MATCHING_EMAILS_LIVE=true is set AFTER securities counsel signs off on
// the wording (mirrors the INVESTOR_OUTREACH_LIVE gate). Until then, the send
// helper is a no-op and only the in-app notifications fire.
//
// Tombstone-safe rules for these templates: facts and process only — no
// performance claims, no solicitation, no guarantee of funding/allocations/returns.

export function matchingEmailsEnabled(): boolean {
  return process.env.MATCHING_EMAILS_LIVE === "true";
}

export type MatchEmailKind = "investor_new_match" | "founder_interest" | "investor_introduced";

export const MATCH_EMAIL_TEMPLATES: Record<MatchEmailKind, { subject: string; body: string }> = {
  investor_new_match: {
    subject: "A new founder match is ready to review",
    body:
      "You have a new fit-scored match in iCapOS. The match is anonymized until both sides consent to an introduction. Review it in your investor workspace. iCapOS facilitates introductions only and takes no part in any transaction.",
  },
  founder_interest: {
    subject: "An investor is interested in connecting",
    body:
      "A matched investor has expressed interest. Review their profile summary and approve the introduction in your founder workspace if you'd like to connect. iCapOS facilitates introductions only and takes no part in any transaction.",
  },
  investor_introduced: {
    subject: "You've been introduced",
    body:
      "A founder has approved your introduction request. You can now view their profile and connect in your investor workspace. iCapOS facilitates introductions only and takes no part in any transaction.",
  },
};
