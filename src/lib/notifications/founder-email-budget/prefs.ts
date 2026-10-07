/**
 * A founder's own email choices (founder_email_prefs). A founder with no row
 * gets the defaults: daily digest, the admin send hour, skip when active.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { FounderEmailMode } from "./config";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

export type FounderEmailPrefs = {
  mode: FounderEmailMode;
  sendHour: number | null;
  timezone: string | null;
  skipIfActive: boolean;
  downshiftedAt: string | null;
  downshiftFrom: FounderEmailMode | null;
};

export const DEFAULT_FOUNDER_PREFS: FounderEmailPrefs = {
  mode: "daily",
  sendHour: null,
  timezone: null,
  skipIfActive: true,
  downshiftedAt: null,
  downshiftFrom: null,
};

/** Fallback zone when a founder never saved one (most founders are US based). */
export const DEFAULT_FOUNDER_TZ = PLATFORM_TZ;

type Row = {
  user_id: string;
  mode: string | null;
  send_hour: number | null;
  timezone: string | null;
  skip_if_active: boolean | null;
  downshifted_at: string | null;
  downshift_from: string | null;
};

const MODES: FounderEmailMode[] = ["daily", "weekly", "instant"];

export function rowToPrefs(row: Partial<Row> | null | undefined): FounderEmailPrefs {
  if (!row) return { ...DEFAULT_FOUNDER_PREFS };
  const mode = MODES.includes(row.mode as FounderEmailMode) ? (row.mode as FounderEmailMode) : "daily";
  const from = MODES.includes(row.downshift_from as FounderEmailMode) ? (row.downshift_from as FounderEmailMode) : null;
  return {
    mode,
    sendHour: typeof row.send_hour === "number" ? row.send_hour : null,
    timezone: row.timezone ?? null,
    skipIfActive: row.skip_if_active === undefined || row.skip_if_active === null ? true : Boolean(row.skip_if_active),
    downshiftedAt: row.downshifted_at ?? null,
    downshiftFrom: from,
  };
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

const COLUMNS = "user_id, mode, send_hour, timezone, skip_if_active, downshifted_at, downshift_from";

export async function loadFounderPrefs(userId: string): Promise<FounderEmailPrefs> {
  try {
    const { data } = await db().from("founder_email_prefs").select(COLUMNS).eq("user_id", userId).maybeSingle();
    return rowToPrefs(data as Row | null);
  } catch {
    return { ...DEFAULT_FOUNDER_PREFS };
  }
}

export async function loadFounderPrefsMany(userIds: string[]): Promise<Map<string, FounderEmailPrefs>> {
  const out = new Map<string, FounderEmailPrefs>();
  if (!userIds.length) return out;
  try {
    for (let i = 0; i < userIds.length; i += 500) {
      const { data } = await db().from("founder_email_prefs").select(COLUMNS).in("user_id", userIds.slice(i, i + 500));
      for (const r of (data ?? []) as Row[]) out.set(r.user_id, rowToPrefs(r));
    }
  } catch {
    // defaults for everyone missing
  }
  return out;
}

export async function saveFounderPrefs(
  userId: string,
  input: { mode?: unknown; sendHour?: unknown; timezone?: unknown; skipIfActive?: unknown },
): Promise<FounderEmailPrefs | null> {
  const patch: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (MODES.includes(input.mode as FounderEmailMode)) {
    patch.mode = input.mode;
    // A founder choosing again clears an automatic downshift and an unsubscribe.
    patch.downshifted_at = null;
    patch.downshift_from = null;
    patch.unsubscribed_at = input.mode === "instant" ? undefined : null;
    if (patch.unsubscribed_at === undefined) delete patch.unsubscribed_at;
  }
  if (input.sendHour === null) patch.send_hour = null;
  else if (Number.isInteger(input.sendHour) && (input.sendHour as number) >= 0 && (input.sendHour as number) <= 23) patch.send_hour = input.sendHour;
  if (isValidTimeZone(input.timezone)) patch.timezone = input.timezone;
  if (typeof input.skipIfActive === "boolean") patch.skip_if_active = input.skipIfActive;
  try {
    const { data, error } = await db().from("founder_email_prefs").upsert(patch, { onConflict: "user_id" }).select(COLUMNS).single();
    if (error) return null;
    return rowToPrefs(data as Row);
  } catch {
    return null;
  }
}
