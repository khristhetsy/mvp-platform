"use client";

import { useCallback, useEffect, useState } from "react";
import type { EventNudge, NudgeSurface } from "@/lib/icfo-events/event-notification-rules";

/**
 * The event nudge for one surface. Fetched once per page load; dismissing hides
 * it at once and saves the choice, so it stays closed for that event.
 */
export function useEventNudge(surface: NudgeSurface): { nudge: EventNudge | null; dismiss: () => void } {
  const [nudge, setNudge] = useState<EventNudge | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/founder/event-nudge?surface=${surface}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { nudge?: EventNudge | null };
        if (active) setNudge(data.nudge ?? null);
      } catch {
        // The nudge is optional: on any failure the page simply shows none.
      }
    })();
    return () => {
      active = false;
    };
  }, [surface]);

  const dismiss = useCallback(() => {
    if (!nudge) return;
    setNudge(null);
    void fetch("/api/founder/event-nudge/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: nudge.eventId }),
    }).catch(() => undefined);
  }, [nudge]);

  return { nudge, dismiss };
}
