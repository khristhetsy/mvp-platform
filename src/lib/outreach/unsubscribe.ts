import { makeUnsubscribeToken } from "@/lib/marketing/send";
import { isUnsubscribed } from "@/lib/marketing/contacts";

/**
 * Investor outreach reuses the platform's existing marketing unsubscribe system
 * (the /unsubscribe page + shared suppression list), so a recipient who opts out
 * of any iCapOS email is suppressed everywhere. No parallel table.
 */

export function buildUnsubscribeUrl(email: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/$/, "");
  return `${base}/unsubscribe?token=${encodeURIComponent(makeUnsubscribeToken(email))}`;
}

/** Returns the set of suppressed emails (normalized) from the given list. */
export async function filterUnsubscribed(emails: string[]): Promise<Set<string>> {
  const suppressed = new Set<string>();
  await Promise.all(
    emails.map(async (email) => {
      if (await isUnsubscribed(email)) suppressed.add(email.trim().toLowerCase());
    }),
  );
  return suppressed;
}
