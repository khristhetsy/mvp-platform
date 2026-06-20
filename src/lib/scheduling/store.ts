import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getValidGoogleAccessToken } from "@/lib/integrations/google-access-token";
import { getGoogleBusyIntervals } from "@/lib/integrations/google-freebusy";
import { listEvents } from "@/lib/calendar/events";
import { availableSlots, configFromSettings } from "./availability";
import { DEFAULT_AVAILABILITY } from "./types";
import type { AvailabilitySettings, TimeInterval, WeeklyRule } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type AvailabilityRow = {
  timezone: string | null;
  slot_minutes: number | null;
  buffer_minutes: number | null;
  weekly_rules: WeeklyRule[] | null;
};

function rowToSettings(row: AvailabilityRow | null): AvailabilitySettings {
  if (!row) return DEFAULT_AVAILABILITY;
  return {
    timezone: row.timezone ?? DEFAULT_AVAILABILITY.timezone,
    slotMinutes: row.slot_minutes ?? DEFAULT_AVAILABILITY.slotMinutes,
    bufferMinutes: row.buffer_minutes ?? DEFAULT_AVAILABILITY.bufferMinutes,
    weeklyRules: Array.isArray(row.weekly_rules) ? row.weekly_rules : DEFAULT_AVAILABILITY.weeklyRules,
  };
}

export async function loadAvailability(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<AvailabilitySettings> {
  const { data } = await raw(supabase)
    .from("scheduling_availability")
    .select("timezone, slot_minutes, buffer_minutes, weekly_rules")
    .eq("profile_id", profileId)
    .maybeSingle();
  return rowToSettings(data as AvailabilityRow | null);
}

export async function saveAvailability(
  supabase: SupabaseClient<Database>,
  profileId: string,
  settings: AvailabilitySettings,
): Promise<AvailabilitySettings> {
  const now = new Date().toISOString();
  const { error } = await raw(supabase)
    .from("scheduling_availability")
    .upsert(
      {
        profile_id: profileId,
        timezone: settings.timezone,
        slot_minutes: settings.slotMinutes,
        buffer_minutes: settings.bufferMinutes,
        weekly_rules: settings.weeklyRules,
        updated_at: now,
      },
      { onConflict: "profile_id" },
    );
  if (error) throw new Error(error.message ?? "Unable to save availability.");
  return settings;
}

/**
 * Open booking slots for a host between from/to. Reads the host's saved hours,
 * their local confirmed events, and (if connected) their Google free/busy — all
 * via the service-role client, since the person booking is a different user.
 */
export async function computeHostSlots(
  hostId: string,
  fromISO: string,
  toISO: string,
  now: Date = new Date(),
): Promise<TimeInterval[]> {
  const admin = createServiceRoleClient();
  const settings = await loadAvailability(admin, hostId);

  const localEvents = await listEvents(admin, hostId, fromISO, toISO);
  const busy: TimeInterval[] = localEvents.map((e) => ({ start: e.start_time, end: e.end_time }));

  const token = await getValidGoogleAccessToken(hostId);
  if ("accessToken" in token && token.accessToken) {
    try {
      const googleBusy = await getGoogleBusyIntervals(token.accessToken, fromISO, toISO);
      busy.push(...googleBusy);
    } catch {
      // ignore — fall back to local busy only
    }
  }

  const config = configFromSettings(settings, new Date(fromISO));
  return availableSlots(new Date(fromISO), new Date(toISO), config, busy, now);
}
