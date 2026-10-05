// Send gate for contact-finder data. A pattern-guessed address (email_source
// "profile") has only had its DOMAIN checked, so nobody knows the mailbox exists.
// It is held back from every bulk send until a mailbox check confirms it.
// See docs/contact-finder-spec.md (D7).

/** crm_contacts.email_source value for an address guessed from the name + domain. */
export const GUESSED_EMAIL_SOURCE = "profile";

/** True when this contact's email is an unconfirmed pattern guess. */
export function isUnconfirmedGuess(row: { email_source?: string | null }): boolean {
  return row.email_source === GUESSED_EMAIL_SOURCE;
}

/** PostgREST filter that keeps rows whose email is NOT a guess (null source counts as not a guess). */
export const NOT_GUESSED_FILTER = `email_source.is.null,email_source.neq.${GUESSED_EMAIL_SOURCE}`;
