/**
 * The founder event nudge: which upcoming event, if any, to point a founder at.
 * Read by GET /api/founder/event-nudge. The choice itself is pickNudgeEvent in
 * event-notification-rules.ts; this file only loads what it needs.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { bannerPublicUrl } from "@/lib/icfo-events/banner";
import { formatSlot } from "@/lib/icfo-events/calendar-links";
import { registeredEventIds } from "@/lib/icfo-events/invitations/person";
import { loadEventNotificationSettings } from "@/lib/icfo-events/notification-settings";
import {
  eventFormatLabel,
  nudgeSurfaceEnabled,
  pickNudgeEvent,
  timeLeftLabel,
  type EventNudge,
  type NudgeSurface,
} from "@/lib/icfo-events/event-notification-rules";

const DAY = 24 * 60 * 60 * 1000;

type Row = {
  id: string; title: string; slug: string; status: string; starts_at: string | null; timezone: string | null;
  format: string | null; cover_path: string | null; cover_focal: string | null; cover_overlay: number | null;
};

/** The nudge for this founder on this surface, or null. */
export async function loadEventNudge(input: {
  profileId: string;
  email: string | null;
  surface: NudgeSurface;
  now?: number;
}): Promise<EventNudge | null> {
  const now = input.now ?? Date.now();
  const settings = await loadEventNotificationSettings();
  if (!nudgeSurfaceEnabled(settings, input.surface)) return null;

  const admin = createServiceRoleClient();
  const client = admin as unknown as SupabaseClient;
  const { data } = await client
    .from("events")
    .select("id, title, slug, status, starts_at, timezone, format, cover_path, cover_focal, cover_overlay")
    .in("status", ["published", "live"])
    .gt("starts_at", new Date(now).toISOString())
    .lte("starts_at", new Date(now + settings.nudgeStartDays * DAY).toISOString())
    .order("starts_at", { ascending: true })
    .limit(20);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return null;

  const ids = rows.map((r) => r.id);
  const [registered, dismissed] = await Promise.all([
    registeredEventIds(ids, { email: input.email, profileId: input.profileId }),
    client.from("event_nudge_dismissals").select("event_id").eq("user_id", input.profileId).in("event_id", ids),
  ]);

  const picked = pickNudgeEvent({
    events: rows.map((r) => ({ ...r, startsAt: r.starts_at })),
    registeredIds: registered,
    // A missing table (migration not applied yet) reads as "nothing dismissed".
    dismissedIds: ((dismissed.data ?? []) as Array<{ event_id: string }>).map((d) => d.event_id),
    nudgeStartDays: settings.nudgeStartDays,
    now,
  });
  if (!picked || !picked.starts_at) return null;

  return {
    eventId: picked.id,
    title: picked.title,
    slug: picked.slug,
    startsAt: picked.starts_at,
    timeLeft: timeLeftLabel(picked.starts_at, now),
    dateLabel: formatSlot(picked.starts_at, picked.timezone),
    formatLabel: eventFormatLabel(picked.format),
    coverUrl: bannerPublicUrl(admin as unknown as SupabaseClient<Database>, picked.cover_path),
    coverFocal: picked.cover_focal,
    coverOverlay: picked.cover_overlay,
  };
}
