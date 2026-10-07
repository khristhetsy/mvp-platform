import { PLATFORM_TZ } from "@/lib/time/platform-tz";
/**
 * Cooldown between Match campaigns. Pure helpers; the database read lives in
 * store.ts (recentMatchEmails).
 *
 * A founder who got a real email from another Match campaign (the Day 0 email
 * or a follow up) within the campaign's cooldown_days is held back with the
 * reason "emailed_recently". Test mode records (dry_run) never count, so test
 * runs don't block real sends.
 */

export type RecentEmail = { at: string; campaignId: string; campaign: string | null };

const DAY_MS = 86_400_000;

/** Start of the cooldown window: anything sent at or after this counts. */
export function cooldownCutoff(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

/** Latest qualifying email per founder contact. */
export function latestByContact(rows: ReadonlyArray<{ contactId: string } & RecentEmail>): Map<string, RecentEmail> {
  const out = new Map<string, RecentEmail>();
  for (const r of rows) {
    const cur = out.get(r.contactId);
    if (!cur || r.at > cur.at) out.set(r.contactId, { at: r.at, campaignId: r.campaignId, campaign: r.campaign });
  }
  return out;
}

/** What the data check shows: 'Emailed Sep 30 by "Your investor matches"'. */
export function cooldownNote(r: RecentEmail): string {
  const day = new Date(r.at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PLATFORM_TZ });
  return r.campaign ? `Emailed ${day} by "${r.campaign}"` : `Emailed ${day} by another Match campaign`;
}
