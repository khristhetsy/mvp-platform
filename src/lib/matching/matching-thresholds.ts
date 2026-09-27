import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readThresholds, type MatchingThresholds } from "@/lib/matching/matching-thresholds-shared";

const KEY = "matching_thresholds";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

/** The thresholds saved on Scheduled jobs, or 60 and 60. */
export async function loadMatchingThresholds(): Promise<MatchingThresholds> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", KEY).maybeSingle();
    return readThresholds((data as { value?: unknown } | null)?.value);
  } catch {
    return readThresholds(null);
  }
}

export async function saveMatchingThresholds(t: MatchingThresholds, actorId: string): Promise<boolean> {
  const { error } = await db()
    .from("platform_settings")
    .upsert({ key: KEY, value: t, updated_by: actorId, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return !error;
}
