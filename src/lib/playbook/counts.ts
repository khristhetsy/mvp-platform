// Live pending-count layer. Each module may declare a logical count_source; this
// maps those keys to REAL, defensive queries. Any query that fails (missing table
// or column) returns null and simply renders no badge — never a fabricated number.

import { createServiceRoleClient } from "@/lib/supabase/admin";

// Loose client — these tables live in different domains and aren't in the generated
// types; access is admin-gated at the route layer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createServiceRoleClient();
}

async function safeCount(run: () => PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> {
  try {
    const { count, error } = await run();
    return error ? null : count ?? 0;
  } catch {
    return null;
  }
}

const SOURCES: Record<string, () => Promise<number | null>> = {
  investors_pending_kyc: () =>
    safeCount(() => db().from("investor_profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "pending")),
  intro_requests_pending: () =>
    safeCount(() => db().from("intro_requests").select("*", { count: "exact", head: true }).in("status", ["requested", "reviewing"])),
  events_pending_applications: () =>
    safeCount(() => db().from("speaker_applications").select("*", { count: "exact", head: true }).in("status", ["submitted", "under_review"])),
};

/** Resolve the requested count sources → { source: pending }. Unknown/failed sources are omitted. */
export async function playbookCounts(sources: string[]): Promise<Record<string, number>> {
  const wanted = [...new Set(sources.filter((s) => s in SOURCES))];
  const out: Record<string, number> = {};
  await Promise.all(
    wanted.map(async (s) => {
      const n = await SOURCES[s]();
      if (n != null) out[s] = n;
    }),
  );
  return out;
}
