"use client";

/**
 * Zoom Meeting SDK stage — embeds a live Zoom meeting IN the Talk Show page
 * (Component View: no Zoom app, no join link). Fetches a Meeting SDK signature
 * from the server, then joins the configured Talk Show meeting and renders Zoom's
 * meeting view inside the stage card. Falls back (renders nothing → parent shows
 * the Join Zoom link) when the Meeting SDK app isn't configured yet.
 *
 * The host starts the meeting from their own Zoom client; viewers here join as
 * participants. Which meeting is joined is fixed server-side (env), so a viewer
 * can only ever land in the Talk Show meeting.
 */

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any -- the Meeting SDK embedded
   client is exposed as a namespace type; strict typing adds no safety here since
   the behaviour can only be verified live in a browser. */

type Phase = "connecting" | "live" | "unconfigured" | "error";

export function TalkShowMeetingStage({ onUnconfigured }: { onUnconfigured?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const res = await fetch("/api/events/talk-show/meeting-signature", { method: "POST" });
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
      const { signature, sdkKey, meetingNumber, password, userName } = (await res.json()) as {
        signature: string;
        sdkKey: string;
        meetingNumber: string;
        password: string;
        userName: string;
      };
      if (cancelled || !rootRef.current) return;

      const mod = await import("@zoom/meetingsdk/embedded");
      const ZoomMtgEmbedded = mod.default;
      const client: any = ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      await client.init({
        zoomAppRoot: rootRef.current,
        language: "en-US",
        patchJsMedia: true,
      });
      if (cancelled) return;

      await client.join({
        signature,
        sdkKey,
        meetingNumber,
        password: password || undefined,
        userName,
      });
      if (!cancelled) setPhase("live");
    }

    run().catch((e) => {
      if (!cancelled) {
        setPhase("error");
        const reason = e?.reason ?? e?.message ?? (typeof e === "string" ? e : "Video failed to start.");
        setMessage(String(reason));
      }
    });

    return () => {
      cancelled = true;
      const client = clientRef.current;
      void (async () => {
        try {
          await client?.leave?.();
        } catch {
          /* ignore */
        }
      })();
    };
  }, [onUnconfigured]);

  if (phase === "unconfigured") return null;

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-subtle)]"
      style={{ background: "#0a1422" }}
    >
      {/* Zoom renders its meeting view into this root. */}
      <div ref={rootRef} className="absolute inset-0 [&_*]:!max-w-full" />
      {phase !== "live" && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm"
          style={{ color: "#8e9bb0" }}
        >
          {phase === "connecting" ? "Connecting to the stage…" : message ?? "Stage unavailable."}
        </div>
      )}
    </div>
  );
}
