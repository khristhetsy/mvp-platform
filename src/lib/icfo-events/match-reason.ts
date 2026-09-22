/**
 * Why these two were matched, in one line.
 *
 * The board has always had a "why matched" column; the email said nothing, so
 * an investor got an introduction with no idea what it was based on. This is
 * the same fact, worded for the person receiving it.
 *
 * Pure, and it never invents: a pair with no shared sector says what the other
 * person is at this event and stops there. 211 of one event's matches are that
 * kind, and dressing them up as something else is worse than a thin reason.
 */

import type { Role } from "@/lib/icfo-events/pair-types";
import { sectorLabel } from "@/lib/icfo-events/sectors";

const AT_EVENT: Record<Role, string> = {
  investor: "Investor at this event",
  founder: "Founder at this event",
  service: "Service provider at this event",
  sponsor: "Sponsor of this event",
  presenter: "Presenting at this event",
};

/** How many sectors to name before it stops being a line. */
const MAX_SECTORS = 3;

/**
 * The line for one match.
 *
 * Shared sectors win when there are any — they are the specific thing the two
 * have in common. Otherwise the other person's place in the room, which is the
 * only true thing left to say.
 */
export function matchReason(input: {
  sharedSectors: string[];
  /** The role of the person being introduced, not the reader's. */
  role: Role;
}): string {
  // Sectors are stored and compared as slugs; nobody should be told they
  // share "ai-ml". Already-labelled values pass through unchanged, so a row
  // written before the backfill still reads properly.
  const shared = input.sharedSectors
    .map((s) => sectorLabel(s.trim()))
    .filter(Boolean);

  if (shared.length) {
    const shown = shared.slice(0, MAX_SECTORS).join(", ");
    const rest = shared.length - MAX_SECTORS;
    return rest > 0 ? `Shared: ${shown} +${rest} more` : `Shared: ${shown}`;
  }

  // A presenter is worth naming as one even when sectors are shared, but that
  // case is handled above; here it is all we have.
  return AT_EVENT[input.role] ?? "At this event";
}
