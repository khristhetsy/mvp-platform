"use client";

import { useEffect } from "react";
import { getSessionId } from "@/lib/analytics/session-id";
import type { FunnelEventName } from "@/lib/analytics/funnel";

/** Fires one client-side funnel event on mount (landing_view, pricing_view, …). */
export function FunnelBeacon({ event }: { event: FunnelEventName }) {
  useEffect(() => {
    const body = JSON.stringify({ sessionId: getSessionId(), eventName: event });
    try {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon && navigator.sendBeacon("/api/funnel", blob)) return;
    } catch {
      /* fall through to fetch */
    }
    void fetch("/api/funnel", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, [event]);
  return null;
}
