"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** Sponsor-owner control to appear "online" on their booth via Realtime presence. */
export function RepOnlineToggle({ sponsorId, repName }: { sponsorId: string; repName: string }) {
  const [online, setOnline] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  function goOffline() {
    if (channelRef.current) {
      const supabase = createClient();
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setOnline(false);
  }

  function goOnline() {
    const supabase = createClient();
    const ch = supabase.channel(`booth:${sponsorId}`, { config: { presence: { key: `rep:${sponsorId}` } } });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ rep: true, name: repName });
    });
    channelRef.current = ch;
    setOnline(true);
  }

  useEffect(() => {
    return () => goOffline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      onClick={() => (online ? goOffline() : goOnline())}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${
        online ? "bg-emerald-600 text-white" : "border border-[var(--border-subtle)] text-[var(--text-secondary)]"
      }`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${online ? "bg-white" : "bg-slate-400"}`} />
      {online ? "You're online at your booth" : "Go online at booth"}
    </button>
  );
}
