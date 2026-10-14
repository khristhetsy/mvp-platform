/**
 * Investor intros for the founder Overview and Attribution tabs.
 *
 * Source: intro requests the founder made through iCapOS (table intro_requests, requested_by
 * is the founder). A request is not yet traced back to a specific post, so this is shown as
 * all intro requests in the period, and labelled that way in the screen.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export async function countFounderIntros(founderId: string, start: Date, end: Date): Promise<number> {
  const { count, error } = await db().from("intro_requests")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", founderId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (error) return 0;
  return count ?? 0;
}
