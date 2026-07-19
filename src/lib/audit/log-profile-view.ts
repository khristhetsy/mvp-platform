import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type ViewSurface = "match_card" | "full_profile" | "data_room";

/**
 * Append an audit row every time an investor views a private founder surface.
 * Service-role insert into the append-only profile_view_log (no update/delete for
 * any role). Best-effort: never blocks the render on a logging failure.
 *
 * Call this from the page-level server component for match cards and full
 * profiles (spec §5.4).
 */
export async function logProfileView(params: {
  viewerUserId: string;
  companyId: string;
  matchId?: string | null;
  surface: ViewSurface;
}): Promise<void> {
  try {
    const db = createServiceRoleClient() as unknown as SupabaseClient;
    await db.from("profile_view_log").insert({
      viewer_user_id: params.viewerUserId,
      company_id: params.companyId,
      match_id: params.matchId ?? null,
      surface: params.surface,
    });
  } catch {
    // audit logging is best-effort and must never break the render
  }
}

/** Count of distinct viewers of a company's private profile (founder engagement metric). */
export async function countProfileViewers(companyId: string): Promise<number> {
  try {
    const db = createServiceRoleClient() as unknown as SupabaseClient;
    const { data } = await db
      .from("profile_view_log")
      .select("viewer_user_id")
      .eq("company_id", companyId)
      .limit(5000);
    const unique = new Set((data ?? []).map((r: { viewer_user_id: string }) => r.viewer_user_id));
    return unique.size;
  } catch {
    return 0;
  }
}
