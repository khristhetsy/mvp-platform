import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { mapStudioRules, type StudioRules } from "./studio";

/** Playout rules for an event. Reads as all unset if the columns are not applied yet. */
export async function loadStudioRules(supabase: SupabaseClient<Database>, eventId: string): Promise<StudioRules> {
  const { data } = await (supabase as unknown as SupabaseClient)
    .from("events")
    .select("spotlight_break_seconds")
    .eq("id", eventId)
    .maybeSingle();
  return mapStudioRules(data as Record<string, unknown> | null);
}
