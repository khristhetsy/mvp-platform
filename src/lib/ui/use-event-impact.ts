"use client";

import { useCallback, useState } from "react";
import type { EventImpact, SessionImpact } from "@/lib/icfo-events/impact";

/**
 * The counts behind a confirmation, fetched when the dialog opens.
 *
 * Deliberately not loaded on render: a page left open since this morning would
 * otherwise confirm against numbers from this morning, and the whole point of
 * the dialog is that the numbers are true at the moment of deciding.
 *
 * A failed count leaves the field null, which the dialog renders as a dash.
 * That is honest; a confident zero would not be.
 */
export function useEventImpact(eventId: string) {
  const [event, setEvent] = useState<EventImpact | null>(null);
  const [session, setSession] = useState<SessionImpact | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (sessionId?: string) => {
    setLoading(true);
    if (sessionId) setSession(null); else setEvent(null);
    try {
      const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
      const res = await fetch(`/api/admin/events/${eventId}/impact${qs}`);
      const json = (await res.json().catch(() => ({}))) as { event?: EventImpact; session?: SessionImpact };
      if (json.event) setEvent(json.event);
      if (json.session) setSession(json.session);
    } catch {
      /* dashes */
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  return { event, session, loading, load };
}
