// Shared venue model for the iCFO Events experience: the canonical room names
// (used as Realtime presence "room" keys) and href helpers for the destination
// nav. Keep these names stable — they're the join key between presence + UI.

export const PRESENCE_ROOMS = ["Lobby", "Main Stage", "Networking", "On-Demand", "Sponsor Hall"] as const;
export type PresenceRoom = (typeof PRESENCE_ROOMS)[number];

export type VenueZone = {
  /** Presence room this nav item maps to, if any (nav-only items have none). */
  room?: PresenceRoom;
  key: string;
  label: string;
  /** lucide-react icon name resolved in the client component. */
  icon: "home" | "stage" | "users" | "tv" | "store" | "calendar" | "trophy";
  href: string;
};

/**
 * Which optional rooms an event actually has content for. Undefined = show
 * (backward compatible). A false flag hides that tab so nobody lands on an
 * empty room (e.g. Tracks when the event has no sector tracks).
 */
export type VenueNavFlags = {
  hasTracks?: boolean;
  hasTalkShow?: boolean;
  hasSponsors?: boolean;
};

/** Build the destination nav for an event. `tracksHref` handles the
 *  sector-tracks deep link the lobby already computes. Optional rooms with no
 *  content are dropped per `flags`. */
export function venueZones(slug: string, tracksHref?: string, flags?: VenueNavFlags): VenueZone[] {
  const base = `/events/${slug}`;
  const zones: VenueZone[] = [
    { key: "lobby", room: "Lobby", label: "Lobby", icon: "home", href: `${base}/lobby` },
    { key: "sessions", room: "Main Stage", label: "Main Stage", icon: "stage", href: `${base}/stage` },
    { key: "talkshow", room: "Main Stage", label: "Talk Show", icon: "tv", href: `${base}/talk-show` },
    { key: "ondemand", room: "On-Demand", label: "Tracks", icon: "calendar", href: tracksHref ?? `${base}/tracks` },
    { key: "networking", room: "Networking", label: "Networking", icon: "users", href: `${base}/lounge` },
    { key: "sponsors", room: "Sponsor Hall", label: "Sponsor Hall", icon: "store", href: `${base}/expo` },
    { key: "leaderboard", label: "Leaderboard", icon: "trophy", href: `${base}/leaderboard` },
  ];
  return zones.filter((z) => {
    if (z.key === "ondemand" && flags?.hasTracks === false) return false;
    if (z.key === "talkshow" && flags?.hasTalkShow === false) return false;
    if (z.key === "sponsors" && flags?.hasSponsors === false) return false;
    return true;
  });
}
