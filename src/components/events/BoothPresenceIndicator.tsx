"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Shows "a rep is here now" when a sponsor rep is present on the booth channel. */
export function BoothPresenceIndicator({ sponsorId }: { sponsorId: string }) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`booth:${sponsorId}`)
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, Array<{ rep?: boolean }>>;
        const reps = Object.values(state)
          .flat()
          .filter((p) => p.rep);
        setOnline(reps.length > 0);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch as Parameters<typeof supabase.removeChannel>[0]);
    };
  }, [sponsorId]);

  if (!online) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
      A rep is here now
    </span>
  );
}
