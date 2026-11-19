import "server-only";
import { getActingContext } from "@/lib/admin/act-on-behalf";

/**
 * Whose Google Calendar the founder calendar should use.
 *
 * While permissioned staff act as a founder, the calendar must show that founder's
 * Google Calendar (or none, when the founder has not connected one), never the staff
 * member's. getActingContext re-verifies the signed cookie, the real signed in user and
 * the act_on_behalf permission, so a null result means there is no acting session.
 */
export async function resolveGoogleCalendarOwnerId(signedInProfileId: string): Promise<string> {
  const acting = await getActingContext();
  return acting ? acting.founderId : signedInProfileId;
}
