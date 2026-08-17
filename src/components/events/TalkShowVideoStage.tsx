"use client";

/**
 * Zoom Video SDK stage — renders the Talk Show as embedded, in-page video (no
 * Zoom app, no join link). Fetches a session token from the server, joins the
 * session, starts the local camera, and renders each participant with video as a
 * tile inside the stage card. Falls back (renders nothing → parent shows the Join
 * Zoom link) when the Video SDK isn't configured yet.
 *
 * SPIKE: proves the embed pipe end to end. The roster-driven "Bring on = live
 * couch tile" mapping (session_guests ↔ Zoom userIdentity) is the next step.
 */

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any -- the Video SDK client/stream
   are dynamically imported and loosely typed here; strict typing adds no safety in
   this spike since the behaviour can only be verified live in a browser. */

type Phase = "connecting" | "live" | "unconfigured" | "error";

export function TalkShowVideoStage({
  sessionName,
  onUnconfigured,
}: {
  sessionName: string;
  onUnconfigured?: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [message, setMessage] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

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
      const { token, userName } = (await res.json()) as { token: string; userName: string };
      if (cancelled) return;

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

      async function attach(userId: number) {
        try {
          const el = await stream.attachVideo(userId, VideoQuality.Video_360P);
          if (el instanceof HTMLElement) {
            el.setAttribute("style", "width:100%;aspect-ratio:16/9;border-radius:8px;overflow:hidden;");
            container.appendChild(el);
          }
        } catch {
          /* one tile failing shouldn't take down the stage */
        }
      }
      async function detach(userId: number) {
        try {
          const els = await stream.detachVideo(userId);
          (Array.isArray(els) ? els : [els]).forEach((e: any) => e?.remove?.());
        } catch {
          /* ignore */
        }
      }

      try {
        await stream.startVideo();
        await attach(client.getCurrentUserInfo().userId);
      } catch {
        /* camera denied — still show remote tiles */
      }
      (client.getAllUser() as any[]).forEach((u) => {
        if (u.bVideoOn) void attach(u.userId);
      });

      const onPeer = (p: { action: string; userId: number }) => {
        if (p.action === "Start") void attach(p.userId);
        else if (p.action === "Stop") void detach(p.userId);
      };
      const onRemoved = (p: any) => {
        (Array.isArray(p) ? p : [p]).forEach((u: any) => void detach(u.userId));
      };
      client.on("peer-video-state-change", onPeer);
      client.on("user-removed", onRemoved);
      cleanups.push(() => {
        client.off("peer-video-state-change", onPeer);
        client.off("user-removed", onRemoved);
      });
    }

    run().catch((e) => {
      if (!cancelled) {
        setPhase("error");
        setMessage(e instanceof Error ? e.message : "Video failed to start.");
      }
    });

    return () => {
      cancelled = true;
      cleanups.forEach((f) => f());
      const client = clientRef.current;
      const stream = streamRef.current;
      void (async () => {
        try {
          await stream?.stopVideo?.();
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
    };
  }, [sessionName, onUnconfigured]);

  async function toggleCam() {
    const stream = streamRef.current;
    if (!stream) return;
    try {
      if (camOn) await stream.stopVideo();
      else await stream.startVideo();
      setCamOn((v) => !v);
    } catch {
      /* ignore */
    }
  }

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
      {phase === "live" && (
        <button
          type="button"
          onClick={toggleCam}
          className="absolute bottom-3 right-3 z-10 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
          style={{ background: camOn ? "#1D9E75" : "#5F5E5A" }}
        >
          {camOn ? "Camera on" : "Camera off"}
        </button>
      )}
    </div>
  );
}
