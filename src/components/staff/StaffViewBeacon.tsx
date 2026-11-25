"use client";

import { useEffect } from "react";

/** Records one view of a staff chat page per browser session. Renders nothing. */
export function StaffViewBeacon({ page, sourceTag }: { page: string; sourceTag: string | null }) {
  useEffect(() => {
    const key = `staff-view-${page}`;
    const fresh = () => Math.random().toString(36).slice(2, 14);
    let sessionId = fresh();
    try {
      const saved = window.sessionStorage.getItem(key);
      if (saved) sessionId = saved;
      else window.sessionStorage.setItem(key, sessionId);
    } catch {
      sessionId = fresh();
    }
    void fetch("/api/staff-agent/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, sessionId, source: sourceTag }),
    }).catch(() => undefined);
  }, [page, sourceTag]);
  return null;
}
