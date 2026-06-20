import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { tipDateKey } from "./select";

// user_preferences isn't in the generated Database types yet; use a raw client
// reference for these reads/writes (mirrors the founder-journey pattern).
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type TipPreference = {
  showTips: boolean;
  dismissedToday: boolean;
};

export async function loadTipPreference(
  supabase: SupabaseClient<Database>,
  profileId: string,
  now: Date = new Date(),
): Promise<TipPreference> {
  type PrefRow = { show_tips: boolean | null; tips_dismissed_on: string | null };
  const result = await raw(supabase)
    .from("user_preferences")
    .select("show_tips, tips_dismissed_on")
    .eq("profile_id", profileId)
    .maybeSingle();
  const { data } = result as { data: PrefRow | null };

  return {
    showTips: data?.show_tips ?? true,
    dismissedToday: data?.tips_dismissed_on === tipDateKey(now),
  };
}

export async function setTipsEnabled(
  supabase: SupabaseClient<Database>,
  profileId: string,
  enabled: boolean,
): Promise<void> {
  await raw(supabase)
    .from("user_preferences")
    .upsert(
      { profile_id: profileId, show_tips: enabled, updated_at: new Date().toISOString() },
      { onConflict: "profile_id" },
    );
}

export async function dismissTipForToday(
  supabase: SupabaseClient<Database>,
  profileId: string,
  now: Date = new Date(),
): Promise<void> {
  await raw(supabase)
    .from("user_preferences")
    .upsert(
      { profile_id: profileId, tips_dismissed_on: tipDateKey(now), updated_at: new Date().toISOString() },
      { onConflict: "profile_id" },
    );
}
