"use client";

import { useRef } from "react";

/** Recorded-session player that records a "viewed" (for points) on first play. */
export function SessionVideo({
  src,
  eventId,
  sessionId,
}: {
  src: string;
  eventId: string;
  sessionId: string;
}) {
  const fired = useRef(false);

  function onPlay() {
    if (fired.current) return;
    fired.current = true;
    fetch(`/api/events/sessions/${sessionId}/viewed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    }).catch(() => {
      /* best-effort — viewing shouldn't depend on the points call */
    });
  }

  return (
    <video
      controls
      preload="none"
      src={src}
      onPlay={onPlay}
      className="mt-3 w-full rounded-lg border border-[var(--border-subtle)] bg-black"
    >
      Your browser doesn&apos;t support embedded video.
    </video>
  );
}
