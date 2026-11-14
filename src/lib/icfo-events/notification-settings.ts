/**
 * Event notification settings: one JSON row in `platform_settings` under
 * "event_notification_settings". Set at Admin, Events, Notifications.
 *
 * Every read is defensive: a missing row, a missing table or a hand edited
 * value returns the defaults, so the cron job and the founder nudge never fail
 * on settings. The rules themselves live in event-notification-rules.ts.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  DEFAULT_EVENT_NOTIFICATION_SETTINGS,
  EVENT_NOTIFICATION_SETTINGS_KEY,
  normalizeEventNotificationSettings,
  validateEventNotificationSettings,
  type EventNotificationSettings,
} from "@/lib/icfo-events/event-notification-rules";

export {
  DEFAULT_EVENT_NOTIFICATION_SETTINGS,
  EVENT_NOTIFICATION_SETTINGS_KEY,
  normalizeEventNotificationSettings,
  validateEventNotificationSettings,
};
export type { EventNotificationSettings };

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export type LoadedEventNotificationSettings = {
  settings: EventNotificationSettings;
  /** When an admin last saved, or null when the defaults are in use. */
  updatedAt: string | null;
};

export async function loadEventNotificationSettingsWithMeta(): Promise<LoadedEventNotificationSettings> {
  try {
    const { data } = await db()
      .from("platform_settings")
      .select("value, updated_at")
      .eq("key", EVENT_NOTIFICATION_SETTINGS_KEY)
      .maybeSingle();
    const row = data as { value?: unknown; updated_at?: string | null } | null;
    if (!row?.value) return { settings: { ...DEFAULT_EVENT_NOTIFICATION_SETTINGS }, updatedAt: null };
    return { settings: normalizeEventNotificationSettings(row.value), updatedAt: row.updated_at ?? null };
  } catch {
    return { settings: { ...DEFAULT_EVENT_NOTIFICATION_SETTINGS }, updatedAt: null };
  }
}

export async function loadEventNotificationSettings(): Promise<EventNotificationSettings> {
  return (await loadEventNotificationSettingsWithMeta()).settings;
}

export type SaveResult =
  | { ok: true; settings: EventNotificationSettings; updatedAt: string }
  | { ok: false; errors: string[] };

/** Validate, then save. Nothing is written when the input has a problem. */
export async function saveEventNotificationSettings(input: unknown, updatedBy: string | null): Promise<SaveResult> {
  const errors = validateEventNotificationSettings(input);
  if (errors.length) return { ok: false, errors };
  const settings = normalizeEventNotificationSettings(input);
  const updatedAt = new Date().toISOString();
  try {
    const { error } = await db()
      .from("platform_settings")
      .upsert(
        { key: EVENT_NOTIFICATION_SETTINGS_KEY, value: settings, updated_by: updatedBy, updated_at: updatedAt },
        { onConflict: "key" },
      );
    if (error) return { ok: false, errors: ["Could not save the settings. Try again."] };
    return { ok: true, settings, updatedAt };
  } catch {
    return { ok: false, errors: ["Could not save the settings. Try again."] };
  }
}
