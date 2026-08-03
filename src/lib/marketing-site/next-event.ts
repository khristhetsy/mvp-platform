import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { NextEvent } from "@/components/marketing-site/AiFirstMode";

/**
 * Soonest registration-open event from marketing_site_events, for the events AI
 * mode card. Cached hourly (unstable_cache) so it stays current without making
 * every marketing page dynamic. Type-only import from the client component keeps
 * server code out of the client bundle. Returns null on error / no open events.
 */
export const loadNextEvent = unstable_cache(
  async (): Promise<NextEvent> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = createServiceRoleClient() as any;
      const { data } = await admin
        .from("marketing_site_events")
        .select("title, city, starts_at, kind, registration_open")
        .eq("registration_open", true)
        .order("starts_at", { ascending: true })
        .limit(1);
      const e = data?.[0];
      return e
        ? { title: e.title, city: e.city, starts_at: e.starts_at, kind: e.kind, registration_open: e.registration_open }
        : null;
    } catch {
      return null;
    }
  },
  ["marketing-next-event"],
  { revalidate: 3600 },
);
