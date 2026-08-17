"use client";

/**
 * Zoom Video SDK stage — renders the Talk Show as embedded, in-page video (no
 * Zoom app, no join link). Roster-driven: the host's Guest Roster ("Bring on /
 * Send back") decides who is on the couch, and this stage renders exactly those
 * people's live tiles. Everyone else watches without broadcasting.
 *
 * How the match works: the video token sets each user's Video SDK `user_identity`
 * to their `profiles.id`. A roster guest stores that same id in
 * `session_guests.profile_id`. So a participant is "on the couch" iff their
 * `userIdentity` is in the set of onstage guests' profile ids — which we load and
 * keep in sync over Supabase Realtime. Local video only broadcasts when the
 * signed-in user is themselves onstage.
 *
 * Falls back (renders nothing → parent shows the Join Zoom link) when the Video
 * SDK isn't configured yet.
 */

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/* eslint-disable @typescript-eslint/no-explicit-any -- the Video SDK client/stream
   are dynamically imported and loosely typed here; strict typing adds no safety in
   this spike since the behaviour can only be verified live in a browser. */

type Phase = "connecting" | "live" | "unconfigured" | "error";
type Row = Record<string, unknown>;
function raw(c: ReturnType<typeof createClient>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export function TalkShowVideoStage({
  sessionId,
  sessionName,
  onUnconfigured,
}: {
  sessionId: string;
  sessionName: string;
  onUnconfigured?: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  // The set of onstage guests' profile ids (== Video SDK user_identity), kept in
  // a ref so the Zoom event handlers always read the latest value.
  const onstageRef = useRef<Set<string>>(new Set());
  const selfIdentityRef = useRef<string | null>(null);
  const attachedRef = useRef<Set<number>>(new Set()); // remote userIds with a live tile
  const broadcastingRef = useRef(false); // is the local camera on the couch?
  const reconcileRef = useRef<() => void>(() => {});

  const [phase, setPhase] = useState<Phase>("connecting");
  const [message, setMessage] = useState<string | null>(null);
  const [tileCount, setTileCount] = useState(0);
  const [onCouch, setOnCouch] = useState(false);

  // ── Roster: load + subscribe to who's onstage ──────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    function applyRows(rows: Row[]) {
      const set = new Set<string>();
      for (const r of rows) {
        if (String(r.status) === "onstage" && r.profile_id) set.add(String(r.profile_id));
      }
      onstageRef.current = set;
      reconcileRef.current();
    }

    (async () => {
      const { data } = await raw(supabase)
        .from("session_guests")
        .select("profile_id,status")
        .eq("session_id", sessionId);
      if (active) applyRows((data ?? []) as Row[]);
    })();

    const ch = supabase
      .channel(`vstage:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_guests", filter: `session_id=eq.${sessionId}` },
        async () => {
          // Re-read the full set on any change (small table; keeps logic simple).
          const { data } = await raw(supabase)
            .from("session_guests")
            .select("profile_id,status")
            .eq("session_id", sessionId);
          if (active) applyRows((data ?? []) as Row[]);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    };
  }, [sessionId]);

  // ── Zoom: join, then render tiles for onstage participants only ─────────────
  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const attached = attachedRef.current;

    async function run() {
      const res = await fetch("/api/events/talk-show/video-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionName }),
      });
      if (res.status === 503) {
        if (!cancelled) {
          setPhase("unconfigured");
          onUnconfigured?.();
        }
        return;
      }
      if (!res.ok) {
        if (!cancelled) {
          setPhase("error");
          setMessage("Couldn't get a stage token. Try again.");
        }
        return;
      }
      const { token, userName, userIdentity } = (await res.json()) as {
        token: string;
        userName: string;
        userIdentity: string;
      };
      if (cancelled) return;
      selfIdentityRef.current = userIdentity;

      const mod = await import("@zoom/videosdk");
      const ZoomVideo = mod.default;
      const { VideoQuality } = mod;
      const client: any = ZoomVideo.createClient();
      clientRef.current = client;
      await client.init("en-US", "Global", { patchJsMedia: true });
      await client.join(sessionName, token, userName);
      const stream: any = client.getMediaStream();
      streamRef.current = stream;
      if (cancelled) return;
      setPhase("live");

      const container = document.createElement("video-player-container");
      container.setAttribute(
        "style",
        "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;width:100%;height:100%;",
      );
      shellRef.current?.appendChild(container);
      containerRef.current = container;

      async function attachRemote(userId: number) {
        if (attachedRef.current.has(userId)) return;
        attachedRef.current.add(userId);
        try {
          const el = await stream.attachVideo(userId, VideoQuality.Video_360P);
          if (el instanceof HTMLElement) {
            el.setAttribute("data-uid", String(userId));
            el.setAttribute("style", "width:100%;aspect-ratio:16/9;border-radius:8px;overflow:hidden;");
            container.appendChild(el);
            setTileCount((n) => n + 1);
          } else {
            attachedRef.current.delete(userId);
          }
        } catch {
          attachedRef.current.delete(userId);
        }
      }
      async function detachRemote(userId: number) {
        if (!attachedRef.current.has(userId)) return;
        attachedRef.current.delete(userId);
        try {
          const els = await stream.detachVideo(userId);
          (Array.isArray(els) ? els : [els]).forEach((e: any) => e?.remove?.());
        } catch {
          /* ignore */
        }
        // Also sweep any lingering element for this uid.
        container.querySelector(`[data-uid="${userId}"]`)?.remove();
        setTileCount(() => container.childElementCount);
      }

      // Reconcile the whole stage against the current onstage set. Called on join,
      // on every roster change, and on every Zoom participant/video event.
      let reconciling = false;
      async function reconcile() {
        if (reconciling || cancelled) return;
        reconciling = true;
        try {
          const set = onstageRef.current;
          const me = client.getCurrentUserInfo?.();
          const myId = selfIdentityRef.current;
          const myUserId: number | undefined = me?.userId;

          // Local broadcast: on only while the signed-in user is onstage.
          const shouldBroadcast = !!myId && set.has(myId);
          if (shouldBroadcast && !broadcastingRef.current) {
            broadcastingRef.current = true;
            try {
              await stream.startVideo();
              if (myUserId != null) await attachRemote(myUserId);
            } catch {
              /* camera denied — remote tiles still render */
            }
          } else if (!shouldBroadcast && broadcastingRef.current) {
            broadcastingRef.current = false;
            try {
              await stream.stopVideo();
            } catch {
              /* ignore */
            }
            if (myUserId != null) await detachRemote(myUserId);
          }
          if (!cancelled) setOnCouch(shouldBroadcast);

          // Remote tiles: attach onstage participants with video on; detach others.
          const all = (client.getAllUser?.() ?? []) as any[];
          for (const u of all) {
            if (myUserId != null && u.userId === myUserId) continue;
            const allowed = !!u.userIdentity && set.has(String(u.userIdentity));
            if (allowed && u.bVideoOn) await attachRemote(u.userId);
            else await detachRemote(u.userId);
          }
        } finally {
          reconciling = false;
        }
      }
      reconcileRef.current = () => void reconcile();

      const onEvent = () => void reconcile();
      client.on("peer-video-state-change", onEvent);
      client.on("user-added", onEvent);
      client.on("user-removed", onEvent);
      cleanups.push(() => {
        client.off("peer-video-state-change", onEvent);
        client.off("user-added", onEvent);
        client.off("user-removed", onEvent);
      });

      // Initial pass (roster may have loaded before or after join).
      await reconcile();
    }

    run().catch((e) => {
      if (!cancelled) {
        setPhase("error");
        setMessage(e instanceof Error ? e.message : "Video failed to start.");
      }
    });

    return () => {
      cancelled = true;
      reconcileRef.current = () => {};
      cleanups.forEach((f) => f());
      const client = clientRef.current;
      const stream = streamRef.current;
      void (async () => {
        try {
          if (broadcastingRef.current) await stream?.stopVideo?.();
        } catch {
          /* ignore */
        }
        try {
          await client?.leave?.();
        } catch {
          /* ignore */
        }
      })();
      containerRef.current?.remove();
      attached.clear();
      broadcastingRef.current = false;
    };
  }, [sessionName, onUnconfigured]);

  if (phase === "unconfigured") return null;

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-subtle)]"
      style={{ background: "#0a1422" }}
    >
      <div ref={shellRef} className="absolute inset-0 p-3" />

      {phase !== "live" && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm" style={{ color: "#8e9bb0" }}>
          {phase === "connecting" ? "Connecting to the stage…" : message ?? "Stage unavailable."}
        </div>
      )}

      {phase === "live" && tileCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm" style={{ color: "#8e9bb0" }}>
          The host brings guests onto the couch — their video appears here.
        </div>
      )}

      {phase === "live" && (
        <span
          className="absolute bottom-3 right-3 z-10 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
          style={{ background: onCouch ? "#1D9E75" : "#26374f" }}
        >
          {onCouch ? "You're on the couch" : "You're in the audience"}
        </span>
      )}
    </div>
  );
}
