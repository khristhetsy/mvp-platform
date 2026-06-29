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

/** Build the destination nav for an event. `tracksHref` handles the
 *  sector-tracks deep link the lobby already computes. The `sessions` and
 *  `ondemand` keys are kept (the Lobby doorways resolve hrefs by these keys)
 *  but now point at the live Main Stage and Sector Tracks rooms. */
export function venueZones(slug: string, tracksHref?: string): VenueZone[] {
  const base = `/events/${slug}`;
  return [
    { key: "lobby", room: "Lobby", label: "Lobby", icon: "home", href: `${base}/lobby` },
    { key: "sessions", room: "Main Stage", label: "Main Stage", icon: "stage", href: `${base}/stage` },
    { key: "talkshow", room: "Main Stage", label: "Talk Show", icon: "tv", href: `${base}/talk-show` },
    { key: "ondemand", room: "On-Demand", label: "Tracks", icon: "calendar", href: tracksHref ?? `${base}/tracks` },
    { key: "networking", room: "Networking", label: "Networking", icon: "users", href: `${base}/lounge` },
    { key: "sponsors", room: "Sponsor Hall", label: "Sponsor Hall", icon: "store", href: `${base}/expo` },
    { key: "leaderboard", label: "Leaderboard", icon: "trophy", href: `${base}/leaderboard` },
  ];
}
