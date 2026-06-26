"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { mapSessionGuest } from "@/lib/icfo-events/live-session";
import type { SessionGuest } from "@/lib/icfo-events/live-session";

type Row = Record<string, unknown>;
function raw(c: ReturnType<typeof createClient>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

/** Public "on stage now" strip for a live talk show — updates live as the host swaps guests. */
export function OnStageGuests({ sessionId }: { sessionId: string }) {
  const [guests, setGuests] = useState<SessionGuest[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data } = await raw(supabase).from("session_guests").select("*").eq("session_id", sessionId);
      if (active) setGuests(((data ?? []) as Row[]).map(mapSessionGuest));
    })();
    const ch = supabase
      .channel(`guests_public:${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_guests", filter: `session_id=eq.${sessionId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setGuests((prev) => prev.filter((g) => g.id !== String((payload.old as Row).id)));
          return;
        }
        const g = mapSessionGuest(payload.new as Row);
        setGuests((prev) => (prev.some((x) => x.id === g.id) ? prev.map((x) => (x.id === g.id ? g : x)) : [...prev, g]));
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    };
  }, [sessionId]);

  const onstage = guests.filter((g) => g.status === "onstage");
  if (onstage.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">On stage now</span>
      {onstage.map((g) => (
        <span key={g.id} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--indigo-soft)] px-3 py-1 text-sm font-medium text-[var(--indigo)]">
          🎙️ {g.displayName}
          {g.roleLabel && <span className="text-xs text-[var(--text-muted)]">· {g.roleLabel}</span>}
        </span>
      ))}
    </div>
  );
}
