"use client";

import { useEventPresence } from "@/components/events/EventPresenceProvider";

/** Live in-room headcount from Realtime presence. Renders nothing until at
 *  least one viewer is tracked, so we never show a fabricated number. */
export function LiveViewerCount({
  room,
  noun = "watching",
  className,
}: {
  room: string;
  noun?: string;
  className?: string;
}) {
  const { byRoom } = useEventPresence();
  const n = byRoom[room] ?? 0;
  if (n <= 0) return null;
  return (
    <span className={className}>
      {n} {noun}
    </span>
  );
}
