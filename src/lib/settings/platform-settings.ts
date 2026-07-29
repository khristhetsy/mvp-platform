import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Small key-value store for platform-level settings that admins toggle at
 * runtime (as opposed to build-time env vars). Backed by the `platform_settings`
 * table; every read/write is defensive so a missing table never breaks a page.
 */

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

const AUTOMATION_KEY = "investor_outreach_automation";

/** Read a boolean setting; returns `fallback` if unset or unreadable. */
export async function getBoolSetting(key: string, fallback = false): Promise<boolean> {
  try {
    const { data } = await db()
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const value = (data as { value?: { enabled?: boolean } } | null)?.value;
    if (value && typeof value.enabled === "boolean") return value.enabled;
    return fallback;
  } catch {
    return fallback;
  }
}

/** Write a boolean setting, attributing the change to an admin user. */
export async function setBoolSetting(key: string, enabled: boolean, updatedBy: string | null): Promise<boolean> {
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert(
        { key, value: { enabled }, updated_by: updatedBy, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Investor-outreach automation master switch. When ON, approved (and
 * auto-approved) campaigns dispatch real Founder-Preview emails on the weekly
 * pass. The build-time env var stays as an override for staging.
 */
export async function getOutreachAutomationEnabled(): Promise<boolean> {
  if (process.env.INVESTOR_OUTREACH_LIVE === "true") return true;
  return getBoolSetting(AUTOMATION_KEY, false);
}

export async function setOutreachAutomationEnabled(enabled: boolean, updatedBy: string | null): Promise<boolean> {
  return setBoolSetting(AUTOMATION_KEY, enabled, updatedBy);
}
