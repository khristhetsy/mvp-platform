// Data-access for the marketing notification tables. Uses the service-role
// marketing client (access control enforced at the API layer via requireRole).

import { marketingDb } from "@/lib/marketing/db";
import type { Channel } from "./catalog";
import { DEFAULT_SETTINGS, type NotifSettings, type NotifPref, type FeedItem } from "./types";

function toTime(v: string): string {
  // Postgres returns time as "HH:MM:SS"; normalize to "HH:MM".
  return v.slice(0, 5);
}

export async function loadSettings(adminId: string): Promise<NotifSettings> {
  const db = marketingDb();
  const { data } = await db.from("mkt_notification_settings").select("*").eq("admin_id", adminId).maybeSingle();
  if (!data) return { admin_id: adminId, ...DEFAULT_SETTINGS };
  return {
    admin_id: adminId,
    master_on: !!data.master_on,
    quiet_hours_on: !!data.quiet_hours_on,
    quiet_start: toTime(String(data.quiet_start ?? "21:00")),
    quiet_end: toTime(String(data.quiet_end ?? "07:00")),
    digest_time: toTime(String(data.digest_time ?? "06:30")),
    default_channels: (data.default_channels ?? ["in_app", "email"]) as Channel[],
    timezone: String(data.timezone ?? "Europe/Paris"),
  };
}

export async function saveSettings(adminId: string, patch: Partial<Omit<NotifSettings, "admin_id">>): Promise<void> {
  const db = marketingDb();
  const row = { admin_id: adminId, ...patch, updated_at: new Date().toISOString() };
  const { error } = await db.from("mkt_notification_settings").upsert(row, { onConflict: "admin_id" });
  if (error) throw new Error(error.message);
}

export async function loadPrefs(adminId: string): Promise<Map<string, NotifPref>> {
  const db = marketingDb();
  const { data } = await db.from("mkt_notification_prefs").select("*").eq("admin_id", adminId);
  const map = new Map<string, NotifPref>();
  for (const r of data ?? []) {
    map.set(r.type_id, {
      type_id: r.type_id,
      enabled: !!r.enabled,
      channels: (r.channels ?? []) as Channel[],
      cadence: r.cadence ?? null,
    });
  }
  return map;
}

export async function savePrefs(adminId: string, prefs: NotifPref[]): Promise<void> {
  if (prefs.length === 0) return;
  const db = marketingDb();
  const now = new Date().toISOString();
  const rows = prefs.map((p) => ({
    admin_id: adminId,
    type_id: p.type_id,
    enabled: p.enabled,
    channels: p.channels,
    cadence: p.cadence,
    updated_at: now,
  }));
  const { error } = await db.from("mkt_notification_prefs").upsert(rows, { onConflict: "admin_id,type_id" });
  if (error) throw new Error(error.message);
}

/** Insert an in-app notification. Returns false if a dedupe collision skipped it. */
export async function insertNotification(row: {
  adminId: string;
  typeId: string;
  title: string;
  body: string;
  link?: string;
  meta?: Record<string, unknown>;
  dedupeKey?: string;
}): Promise<boolean> {
  const db = marketingDb();
  const { error } = await db.from("mkt_notifications").insert({
    admin_id: row.adminId,
    type_id: row.typeId,
    title: row.title,
    body: row.body,
    link: row.link ?? null,
    meta: row.meta ?? {},
    dedupe_key: row.dedupeKey ?? null,
  });
  if (error) {
    // 23505 = unique_violation on the dedupe index → already delivered this window.
    if ((error as { code?: string }).code === "23505") return false;
    throw new Error(error.message);
  }
  return true;
}

export async function listFeed(
  adminId: string,
  opts: { unread?: boolean; limit?: number; before?: string } = {},
): Promise<{ items: FeedItem[]; unreadCount: number }> {
  const db = marketingDb();
  let q = db
    .from("mkt_notifications")
    .select("id,type_id,title,body,link,meta,read_at,created_at")
    .eq("admin_id", adminId)
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 30, 100));
  if (opts.unread) q = q.is("read_at", null);
  if (opts.before) q = q.lt("created_at", opts.before);
  const { data } = await q;

  const { count } = await db
    .from("mkt_notifications")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .is("read_at", null);

  return { items: (data ?? []) as FeedItem[], unreadCount: count ?? 0 };
}

export async function markRead(adminId: string, opts: { id?: string; all?: boolean }): Promise<void> {
  const db = marketingDb();
  const now = new Date().toISOString();
  let q = db.from("mkt_notifications").update({ read_at: now }).eq("admin_id", adminId).is("read_at", null);
  if (opts.id && !opts.all) q = q.eq("id", opts.id);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

/** All admin/analyst profile ids — used by the reminder cron to evaluate per-admin. */
export async function listAdminIds(): Promise<string[]> {
  const db = marketingDb();
  const { data } = await db.from("profiles").select("id").in("role", ["admin", "analyst"]);
  return (data ?? []).map((r: { id: string }) => r.id);
}
