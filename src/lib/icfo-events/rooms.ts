// Pure helpers that pick which session "fills" each live room (Main Stage,
// Talk Show) and group sessions into sector tracks. No data fabrication — every
// value comes from the real sessions list.

import type { EventSession } from "./types";

const HEADLINE_RANK: Record<EventSession["type"], number> = {
  keynote: 0,
  panel: 1,
  founder_showcase: 2,
  workshop: 3,
  talk_show: 9,
};

function byStartAsc(a: EventSession, b: EventSession): number {
  return (a.startsAt ?? "").localeCompare(b.startsAt ?? "") || a.position - b.position;
}

/** Rank candidates: sectorless first, then by type (keynote highest), then by start. */
function headlineCompare(a: EventSession, b: EventSession): number {
  const aSectorless = a.sectorSlug ? 1 : 0;
  const bSectorless = b.sectorSlug ? 1 : 0;
  if (aSectorless !== bSectorless) return aSectorless - bSectorless;
  if (HEADLINE_RANK[a.type] !== HEADLINE_RANK[b.type]) return HEADLINE_RANK[a.type] - HEADLINE_RANK[b.type];
  return byStartAsc(a, b);
}

/** The headline Main Stage session: a live non-talk-show session if one is on
 *  air, otherwise the next scheduled one. Talk shows have their own room. */
export function pickMainStageSession(sessions: EventSession[]): EventSession | null {
  const eligible = sessions.filter((s) => s.type !== "talk_show" && s.status !== "draft");
  const live = eligible.filter((s) => s.status === "live").sort(headlineCompare);
  if (live.length) return live[0];
  const scheduled = eligible.filter((s) => s.status === "scheduled").sort(headlineCompare);
  return scheduled[0] ?? null;
}

/** The featured Talk Show session: live first, then next scheduled. */
export function pickTalkShowSession(sessions: EventSession[]): EventSession | null {
  const shows = sessions.filter((s) => s.type === "talk_show" && s.status !== "draft");
  const live = shows.filter((s) => s.status === "live").sort(byStartAsc);
  if (live.length) return live[0];
  const scheduled = shows.filter((s) => s.status === "scheduled").sort(byStartAsc);
  return scheduled[0] ?? null;
}

export interface SectorTrackView {
  sectorSlug: string;
  label: string;
  /** The session to feature for this track: live one, else next scheduled. */
  nowPlaying: EventSession | null;
  isLive: boolean;
  /** Every visible session in this track, in running order. */
  agenda: EventSession[];
}

/** Group an event's sessions into per-sector tracks for the Tracks room. */
export function buildSectorTracks(
  sectors: { sectorSlug: string; label: string }[],
  sessions: EventSession[],
): SectorTrackView[] {
  return sectors.map((sec) => {
    const inTrack = sessions
      .filter((s) => s.sectorSlug === sec.sectorSlug && s.status !== "draft")
      .sort(byStartAsc);
    const live = inTrack.find((s) => s.status === "live") ?? null;
    const nextScheduled = inTrack.find((s) => s.status === "scheduled") ?? null;
    return {
      sectorSlug: sec.sectorSlug,
      label: sec.label,
      nowPlaying: live ?? nextScheduled ?? inTrack[0] ?? null,
      isLive: Boolean(live),
      agenda: inTrack,
    };
  });
}
