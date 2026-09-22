/**
 * Meeting links that belong to us.
 *
 * Introductions used to mint a Google Meet from *the clicker's own connected
 * Google account*. Most attendees have never connected Google, so the button
 * failed — immediately after they accepted an introduction, which is the worst
 * possible moment for it.
 *
 * The platform already creates rooms for its own sessions. Introductions use
 * the same path, so neither party needs an account anywhere.
 */
import "server-only";

import { getVideoProvider } from "@/lib/icfo-events/video/provider";
import { isLiveVideoConfigured } from "@/lib/icfo-events/video/whereby";

export type MeetingRoom = {
  /** The link both parties open. */
  url: string;
  /** Rooms expire; after this the link is dead and a new one is needed. */
  expiresAt: string;
};

export type MeetingResult =
  | { ok: true; room: MeetingRoom }
  | { ok: false; reason: string };

/**
 * How long an introduction room stays open.
 *
 * The provider caps a room's life, so a slot booked for next month cannot be
 * minted today. Rooms are created close to the meeting instead — this is the
 * ceiling, not a promise.
 */
export const ROOM_TTL_HOURS = 24;

/** Can we mint a room at all? Checked before offering the option, not after. */
export function meetingLinksAvailable(): boolean {
  return isLiveVideoConfigured();
}

/**
 * A room for two people to meet in.
 *
 * Never throws: a failure here follows an accepted introduction, and the
 * introduction stands whether or not the room could be created. The caller
 * shows the reason and offers messaging instead.
 */
export async function createIntroductionRoom(
  input: { introductionId: string; title: string },
): Promise<MeetingResult> {
  if (!meetingLinksAvailable()) {
    return { ok: false, reason: "Video rooms aren't configured for this workspace." };
  }
  try {
    // The live provider explicitly — the default is the recorded one, which
    // returns an empty join URL and would look like a silent success.
    const room = await getVideoProvider("whereby").createRoom({
      sessionId: input.introductionId,
      title: input.title.slice(0, 120),
    });
    if (!room?.joinUrl) return { ok: false, reason: "The video provider returned no room." };
    return {
      ok: true,
      room: {
        url: room.joinUrl,
        expiresAt: new Date(Date.now() + ROOM_TTL_HOURS * 3600 * 1000).toISOString(),
      },
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Could not create the room." };
  }
}
