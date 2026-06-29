"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { PresenceRoom } from "@/lib/icfo-events/venue";

export type PresenceMember = { id: string; name: string; room: string };

export type VenueAnnouncement = {
  id: string;
  title: string;
  body: string;
  /** Room being announced (e.g. "Main Stage") + a deep link to enter it. */
  room?: string;
  href?: string;
  ts: number;
};

export type ModerationSignal = {
  targetId: string;
  action: "move" | "remove" | "mute" | "unmute";
  room?: string;
  href?: string;
};

type PresenceValue = {
  members: PresenceMember[];
  total: number;
  byRoom: Record<string, number>;
  me: { id: string; name: string };
  /** Set when a moderator mutes this attendee (live). */
  muted: boolean;
  announcement: VenueAnnouncement | null;
  dismissAnnouncement: () => void;
  /** Broadcast a live announcement to everyone in the venue (admin use). */
  sendAnnounce: (a: Omit<VenueAnnouncement, "id" | "ts">) => void;
  /** Signal a specific attendee to move rooms or be removed (admin use). */
  sendModeration: (s: ModerationSignal) => void;
};

const Ctx = createContext<PresenceValue | null>(null);

function anonId(): string {
  return "guest-" + Math.random().toString(36).slice(2, 10);
}

export function EventPresenceProvider({
  eventId,
  slug,
  room,
  me: meProp,
  children,
}: {
  eventId: string;
  slug?: string;
  room: PresenceRoom;
  me?: { id: string; name: string } | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [me] = useState<{ id: string; name: string }>(() => meProp ?? { id: anonId(), name: "Guest" });
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [announcement, setAnnouncement] = useState<VenueAnnouncement | null>(null);
  const [muted, setMuted] = useState(false);
  const chRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const roomRef = useRef(room);
  const meRef = useRef(me);
  const slugRef = useRef(slug);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`event_presence:${eventId}`, {
      config: { presence: { key: me.id } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, Array<{ id?: string; name?: string; room?: string }>>;
      const flat = Object.values(state)
        .flat()
        .map((p) => ({ id: String(p.id ?? ""), name: String(p.name ?? "Attendee"), room: String(p.room ?? "Lobby") }))
        .filter((p) => p.id);
      const map = new Map<string, PresenceMember>();
      flat.forEach((p) => map.set(p.id, p));
      setMembers([...map.values()]);
    });

    ch.on("broadcast", { event: "announce" }, ({ payload }) => {
      setAnnouncement(payload as VenueAnnouncement);
    });

    ch.on("broadcast", { event: "moderation" }, ({ payload }) => {
      const sig = payload as ModerationSignal;
      if (sig.targetId !== meRef.current.id) return;
      if (sig.action === "move" && sig.href) router.push(sig.href);
      else if (sig.action === "remove") router.replace(slugRef.current ? `/events/${slugRef.current}` : "/events");
      else if (sig.action === "mute") setMuted(true);
      else if (sig.action === "unmute") setMuted(false);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        subscribedRef.current = true;
        await ch.track({ id: me.id, name: me.name, room: roomRef.current });
      }
    });

    chRef.current = ch;
    return () => {
      subscribedRef.current = false;
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    };
  }, [eventId, me.id, me.name, router]);

  useEffect(() => {
    const ch = chRef.current;
    if (ch && subscribedRef.current) void ch.track({ id: me.id, name: me.name, room });
  }, [room, me.id, me.name]);

  const sendAnnounce = useCallback((a: Omit<VenueAnnouncement, "id" | "ts">) => {
    void chRef.current?.send({
      type: "broadcast",
      event: "announce",
      payload: { ...a, id: Math.random().toString(36).slice(2), ts: Date.now() } satisfies VenueAnnouncement,
    });
  }, []);

  const sendModeration = useCallback((s: ModerationSignal) => {
    void chRef.current?.send({ type: "broadcast", event: "moderation", payload: s });
  }, []);

  const dismissAnnouncement = useCallback(() => setAnnouncement(null), []);

  const value = useMemo<PresenceValue>(() => {
    const byRoom: Record<string, number> = {};
    for (const m of members) byRoom[m.room] = (byRoom[m.room] ?? 0) + 1;
    return { members, total: members.length, byRoom, me, muted, announcement, dismissAnnouncement, sendAnnounce, sendModeration };
  }, [members, me, muted, announcement, dismissAnnouncement, sendAnnounce, sendModeration]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEventPresence(): PresenceValue {
  return (
    useContext(Ctx) ?? {
      members: [],
      total: 0,
      byRoom: {},
      me: { id: "", name: "" },
      muted: false,
      announcement: null,
      dismissAnnouncement: () => {},
      sendAnnounce: () => {},
      sendModeration: () => {},
    }
  );
}
