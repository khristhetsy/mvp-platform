"use client";

/**
 * Zoom Meeting SDK stage — embeds a live Zoom meeting IN the Talk Show page
 * (Component View: no Zoom app, no join link). Fetches a Meeting SDK signature
 * from the server, then joins the configured Talk Show meeting and renders Zoom's
 * meeting view inside the stage card. Falls back (renders nothing → parent shows
 * the Join Zoom link) when the Meeting SDK app isn't configured yet.
 *
 * The Zoom Web SDK is loaded from Zoom's CDN at runtime (not bundled) — its UMD
 * build doesn't play well with the app bundler, and CDN loading is Zoom's own
 * recommended path for Component View. We inject React/ReactDOM + the embedded
 * bundle (in that order) and use the resulting `window.ZoomMtgEmbedded` global.
 *
 * The host starts the meeting from their own Zoom client; viewers here join as
 * participants. Which meeting is joined is fixed server-side (env).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any -- the CDN-loaded Meeting SDK
   is only available as a window global with no bundled types; behaviour can only
   be verified live in a browser. */

type Phase = "connecting" | "live" | "unconfigured" | "error";

const ZOOM_VERSION = "6.2.0";
const CDN = `https://source.zoom.us/${ZOOM_VERSION}`;
// Order matters: React + ReactDOM globals must exist before the embedded bundle.
const SCRIPTS = [
  `${CDN}/lib/vendor/react.min.js`,
  `${CDN}/lib/vendor/react-dom.min.js`,
  `${CDN}/zoom-meeting-embedded-${ZOOM_VERSION}.min.js`,
];

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-zoomsdk="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.dataset.zoomsdk = src;
    s.addEventListener("load", () => {
      s.dataset.loaded = "true";
      resolve();
    });
    s.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(s);
  });
}

async function loadZoomEmbedded(): Promise<any> {
  for (const src of SCRIPTS) await loadScript(src); // sequential preserves order
  return (window as any).ZoomMtgEmbedded;
}

export function TalkShowMeetingStage({ sessionId, fallback }: { sessionId: string; fallback?: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const res = await fetch("/api/events/talk-show/meeting-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.status === 503) {
        if (!cancelled) setPhase("unconfigured");
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

      const ZoomMtgEmbedded = await loadZoomEmbedded();
      if (cancelled || !rootRef.current || !ZoomMtgEmbedded) return;

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
  }, [sessionId]);

  // Not configured yet (no Client Secret) → show the Join Zoom fallback instead.
  if (phase === "unconfigured") return <>{fallback ?? null}</>;

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
