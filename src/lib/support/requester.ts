/**
 * Who is sending a support request. A founder or investor is themselves. Staff acting
 * as a founder (see admin/act-on-behalf) send it for that founder. The normal check
 * runs first, so signed in founders and investors behave exactly as before; the acting
 * path is only a fallback for a request that would otherwise be refused.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveActingFounderScope } from "@/lib/admin/act-on-behalf";
import type { Company, Database, Profile } from "@/lib/supabase/types";

export type SupportRequester = {
  profile: Profile;
  supabase: SupabaseClient<Database>;
  /** Set only while staff act as a founder: the founder's primary company. */
  actingCompany: Company | null;
  /** Set only while staff act as a founder: the staff member who is really sending it. */
  actingStaffId: string | null;
};

export async function resolveSupportRequester(): Promise<SupportRequester | null> {
  const own = await requireRole(["founder", "investor"]).catch(() => null);
  if (own) {
    const supabase = (await createServerSupabaseClient()) as unknown as SupabaseClient<Database>;
    return { profile: own as Profile, supabase, actingCompany: null, actingStaffId: null };
  }

  const scope = await resolveActingFounderScope();
  if (!scope) return null;
  return {
    profile: scope.profile,
    supabase: scope.supabase,
    actingCompany: scope.company,
    actingStaffId: scope.actingStaffId,
  };
}
