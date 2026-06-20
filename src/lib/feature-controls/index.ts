import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type FeatureKey = "inbox" | "calendar" | "scheduling";
export type FeatureAudience = "founder" | "investor";

export const FEATURE_KEYS: FeatureKey[] = ["inbox", "calendar", "scheduling"];
export const FEATURE_AUDIENCES: FeatureAudience[] = ["founder", "investor"];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  inbox: "Inbox",
  calendar: "Calendar",
  scheduling: "Scheduling",
};

/** Nav hrefs each feature governs, by audience. Used to hide menu items. */
export const FEATURE_HREFS: Record<FeatureAudience, Record<FeatureKey, string[]>> = {
  founder: {
    inbox: ["/founder/inbox"],
    calendar: ["/founder/calendar"],
    scheduling: ["/founder/schedule"],
  },
  investor: {
    inbox: ["/investor/inbox"],
    calendar: ["/investor/calendar"],
    scheduling: ["/investor/schedule"],
  },
};

/** Flat map keyed `${audience}:${feature}` → enabled. Missing key = enabled. */
export type FeatureFlagMap = Record<string, boolean>;

function flagKey(audience: FeatureAudience, feature: FeatureKey): string {
  return `${audience}:${feature}`;
}

// feature_flags isn't in the generated types yet — raw client.
function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function loadFeatureFlags(supabase: SupabaseClient<Database>): Promise<FeatureFlagMap> {
  const map: FeatureFlagMap = {};
  try {
    const { data } = await raw(supabase).from("feature_flags").select("audience, feature, enabled");
    for (const r of (data ?? []) as Array<{ audience: string; feature: string; enabled: boolean }>) {
      map[`${r.audience}:${r.feature}`] = r.enabled;
    }
  } catch {
    // table missing / error → treat everything as enabled
  }
  return map;
}

/** Features default to enabled unless an admin has explicitly turned them off. */
export function isFeatureEnabled(map: FeatureFlagMap, audience: FeatureAudience, feature: FeatureKey): boolean {
  return map[flagKey(audience, feature)] !== false;
}

/** The nav hrefs that should be hidden for this audience given the flag map. */
export function disabledHrefsFor(map: FeatureFlagMap, audience: FeatureAudience): string[] {
  const hidden: string[] = [];
  for (const feature of FEATURE_KEYS) {
    if (!isFeatureEnabled(map, audience, feature)) hidden.push(...FEATURE_HREFS[audience][feature]);
  }
  return hidden;
}
