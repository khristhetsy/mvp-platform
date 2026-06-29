"use client";

import Link from "next/link";
import { Home, Presentation, Users, Tv, Store, Calendar, Trophy } from "lucide-react";
import { venueZones, type VenueZone } from "@/lib/icfo-events/venue";
import { useEventPresence } from "@/components/events/EventPresenceProvider";

const ICONS: Record<VenueZone["icon"], typeof Home> = {
  home: Home,
  stage: Presentation,
  users: Users,
  tv: Tv,
  store: Store,
  calendar: Calendar,
  trophy: Trophy,
};

/** Shared destination nav for every event surface. Highlights the current zone
 *  ("you are here") and shows the live in-venue count from presence. */
export function EventVenueHeader({
  slug,
  current,
  tracksHref,
}: {
  slug: string;
  current: string;
  tracksHref?: string;
}) {
  const { total } = useEventPresence();
  const zones = venueZones(slug, tracksHref);

  return (
    <nav
      aria-label="Event venue"
      className="flex items-center gap-1 overflow-x-auto px-2.5 py-2"
      style={{ background: "#081a30" }}
    >
      {zones.map((z) => {
        const Icon = ICONS[z.icon];
        const active = z.key === current;
        return (
          <Link
            key={z.key}
            href={z.href}
            aria-current={active ? "page" : undefined}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={
              active
                ? { background: "#1D9E75", color: "#ffffff" }
                : { color: "#aeb8c7" }
            }
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {z.label}
          </Link>
        );
      })}
      <span
        className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
        style={{ color: "#cdd6e4" }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#5DCAA5" }} aria-hidden />
        {total} in the venue
      </span>
    </nav>
  );
}
