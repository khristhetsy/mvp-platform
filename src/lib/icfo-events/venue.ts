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
 *  sector-tracks deep link the lobby already computes. */
export function venueZones(slug: string, tracksHref?: string): VenueZone[] {
  const base = `/events/${slug}`;
  return [
    { key: "lobby", room: "Lobby", label: "Lobby", icon: "home", href: `${base}/lobby` },
    { key: "sessions", room: "Main Stage", label: "Sessions", icon: "stage", href: `${base}#agenda` },
    { key: "networking", room: "Networking", label: "Networking", icon: "users", href: `${base}/lounge` },
    { key: "ondemand", room: "On-Demand", label: "On-Demand", icon: "tv", href: tracksHref ?? `${base}#agenda` },
    { key: "sponsors", room: "Sponsor Hall", label: "Sponsor Hall", icon: "store", href: `${base}/expo` },
    { key: "agenda", label: "Agenda", icon: "calendar", href: `${base}#agenda` },
    { key: "leaderboard", label: "Leaderboard", icon: "trophy", href: `${base}/leaderboard` },
  ];
}
