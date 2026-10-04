import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ADMIN_HOME_KEY, DEFAULT_ADMIN_HOME, normalizeAdminHome, type AdminHomeSettings } from "./admin-home-shape";

/** Stored in the existing platform_settings table (key "admin_home"); no schema change. */
function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function getAdminHomeSettings(): Promise<AdminHomeSettings> {
  try {
    const { data } = await db().from("platform_settings").select("value").eq("key", ADMIN_HOME_KEY).maybeSingle();
    return normalizeAdminHome((data as { value?: unknown } | null)?.value);
  } catch {
    return DEFAULT_ADMIN_HOME;
  }
}

export async function setAdminHomeSettings(settings: AdminHomeSettings, updatedBy: string | null): Promise<boolean> {
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert(
        { key: ADMIN_HOME_KEY, value: normalizeAdminHome(settings), updated_by: updatedBy, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    return !error;
  } catch {
    return false;
  }
}
