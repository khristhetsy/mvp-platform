"use client";

import { useRef, type ComponentProps } from "react";
import { MatchCard } from "@/app/fit/FitFunnelClient";

type CardMatch = ComponentProps<typeof MatchCard>["m"];

/**
 * The /fit match card, unchanged, plus a count of each time the founder opens
 * this investor's profile. The count names the most viewed investor in the
 * Match campaign follow up. Only opens are counted, not closes.
 */
export function TrackedMatch({ token, matchId, track, m }: { token: string; matchId: string | null; track: boolean; m: CardMatch }) {
  const box = useRef<HTMLDivElement>(null);
  const open = useRef(false);

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const header = box.current?.querySelector("button");
    if (!header || !(e.target instanceof Node) || !header.contains(e.target)) return;
    open.current = !open.current;
    if (!open.current || !track || !matchId) return;
    const body = JSON.stringify({ token, match_id: matchId });
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) navigator.sendBeacon("/api/match/view", new Blob([body], { type: "application/json" }));
      else void fetch("/api/match/view", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    } catch {
      // Tracking is best effort; the page works without it.
    }
  }

  return (
    <div ref={box} onClickCapture={onClick}>
      <MatchCard m={m} />
    </div>
  );
}
