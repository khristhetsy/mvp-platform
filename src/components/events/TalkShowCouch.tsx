"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { mapSessionGuest } from "@/lib/icfo-events/live-session";
import type { SessionGuest } from "@/lib/icfo-events/live-session";
import { mapSegment, liveSegmentLabel } from "@/lib/icfo-events/segments";
import type { SessionSegment } from "@/lib/icfo-events/segments";
import { LiveViewerCount } from "@/components/events/LiveViewerCount";

type Row = Record<string, unknown>;
function raw(c: ReturnType<typeof createClient>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const SEAT_COLORS = [
  { bg: "#9FE1CB", fg: "#0F6E56" },
  { bg: "#FAC775", fg: "#854F0B" },
  { bg: "#F5C4B3", fg: "#993C1D" },
  { bg: "#C9D2FB", fg: "#1A6CE4" },
];
const MIN_SEATS = 4;

/** The talk-show "couch": host + on-stage guests rendered as seats, with the
 *  segment/run-of-show strip. On-stage guests update live as the host swaps
 *  them (driven by the same session_guests table as OnStageGuests). */
export function TalkShowCouch({
  sessionId,
  presenceRoom,
  segmentTitle,
  initialSegments = [],
  runOfShow,
  isLive,
}: {
  sessionId: string;
  presenceRoom: string;
  segmentTitle: string;
  initialSegments?: SessionSegment[];
  runOfShow: string[];
  isLive: boolean;
}) {
  const t = useTranslations("eventsCmp");
  const [guests, setGuests] = useState<SessionGuest[]>([]);
  const [segments, setSegments] = useState<SessionSegment[]>(initialSegments);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data } = await raw(supabase).from("session_guests").select("*").eq("session_id", sessionId).order("position");
      if (active) setGuests(((data ?? []) as Row[]).map(mapSessionGuest));
    })();
    const ch = supabase
      .channel(`couch:${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_guests", filter: `session_id=eq.${sessionId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setGuests((prev) => prev.filter((g) => g.id !== String((payload.old as Row).id)));
          return;
        }
        const g = mapSessionGuest(payload.new as Row);
        setGuests((prev) => (prev.some((x) => x.id === g.id) ? prev.map((x) => (x.id === g.id ? g : x)) : [...prev, g]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "session_segments", filter: `session_id=eq.${sessionId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setSegments((prev) => prev.filter((s) => s.id !== String((payload.old as Row).id)));
          return;
        }
        const seg = mapSegment(payload.new as Row);
        setSegments((prev) => (prev.some((x) => x.id === seg.id) ? prev.map((x) => (x.id === seg.id ? seg : x)) : [...prev, seg]));
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    };
  }, [sessionId]);

  const liveLabel = liveSegmentLabel(segments) ?? segmentTitle;

  const onstage = guests.filter((g) => g.status === "onstage");
  // Host first (role label mentions "host"), then the rest.
  const ordered = [...onstage].sort((a, b) => {
    const ah = /host|moderator|mc/i.test(a.roleLabel ?? "") ? 0 : 1;
    const bh = /host|moderator|mc/i.test(b.roleLabel ?? "") ? 0 : 1;
    return ah - bh;
  });

  const seats: (SessionGuest | null)[] = [...ordered];
  while (seats.length < MIN_SEATS) seats.push(null);

  return (
    <div className="rounded-2xl p-5" style={{ background: "#0a1422" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-block rounded-full px-3 py-1.5 text-xs" style={{ background: "#16294a", color: "#cdd6e4" }}>
          {liveLabel}
        </span>
        {isLive && (
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "#E24B4A" }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden /> ON AIR
            <LiveViewerCount room={presenceRoom} noun="" className="ml-0.5" />
          </span>
        )}
      </div>

      <div className="my-6 flex flex-wrap items-start justify-around gap-4">
        {seats.map((g, i) => {
          if (!g) {
            return (
              <div key={`empty-${i}`} className="text-center">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-2xl"
                  style={{ background: "#16294a", color: "#5b6e86", border: "1px dashed #34507a" }}
                >
                  +
                </div>
                <p className="mt-1.5 text-[10px] uppercase tracking-wide" style={{ color: "#5b6e86" }}>{t("empty")}</p>
              </div>
            );
          }
          const isHost = /host|moderator|mc/i.test(g.roleLabel ?? "");
          const c = isHost ? { bg: "#E6F1FB", fg: "#0C447C" } : SEAT_COLORS[i % SEAT_COLORS.length];
          return (
            <div key={g.id} className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full text-base font-semibold" style={{ background: c.bg, color: c.fg }}>
                {initials(g.displayName)}
              </div>
              <p className="mt-1.5 text-[10px] uppercase tracking-wide" style={{ color: "#aeb8c7" }}>
                {isHost ? "Host" : "Guest"}
              </p>
              <p className="max-w-[6rem] truncate text-[11px]" style={{ color: "#cdd6e4" }}>{g.displayName}</p>
            </div>
          );
        })}
      </div>

      {runOfShow.length > 0 && (
        <p className="text-xs" style={{ color: "#8e9bb0" }}>
          Run of show: {runOfShow.join(" → ")}
        </p>
      )}
      {onstage.length === 0 && (
        <p className="text-xs" style={{ color: "#8e9bb0" }}>{t("the_host_brings_guests_to_the_couch_seats_fi")}</p>
      )}
    </div>
  );
}
