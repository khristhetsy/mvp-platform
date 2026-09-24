/**
 * Reading and saving the per-screen display settings.
 *
 * Stored in platform_settings under one key. Never throws: a failed read
 * returns no overrides, which is exactly what every screen did before this
 * setting existed.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getInvestorMatchConfig } from "@/lib/settings/platform-settings";
import {
  resolveSurface,
  type DisplayConfig,
  type DisplaySurface,
  type MatchRequiredKey,
  type ResolvedSurface,
} from "@/lib/profile-fields/display";

const KEY = "profile_field_display";

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function loadDisplayConfig(): Promise<DisplayConfig> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", KEY).maybeSingle();
    const v = (data as { value?: DisplayConfig } | null)?.value;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export async function saveDisplayConfig(config: DisplayConfig, updatedBy: string | null): Promise<boolean> {
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert({ key: KEY, value: config, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return !error;
  } catch {
    return false;
  }
}

export async function loadMatchRequired(): Promise<Partial<Record<MatchRequiredKey, boolean>>> {
  const cfg = await getInvestorMatchConfig();
  return cfg.requiredFields;
}

/** The resolved settings for one screen, ready to hand to its form. */
export async function loadSurfaceDisplay(surface: DisplaySurface): Promise<ResolvedSurface> {
  const [config, required] = await Promise.all([loadDisplayConfig(), loadMatchRequired()]);
  return resolveSurface(config, surface, required);
}
