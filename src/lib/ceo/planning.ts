// CEO Hub — goals CRUD + notification prefs. Service-role, admin-gated at the route.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return serviceRoleClientUntyped(); }

export interface Goal { id: string; title: string; metric: string | null; target: number | null; current: number; period: string | null; dueDate: string | null; sortOrder: number }
export interface GoalInput { title: string; metric?: string | null; target?: number | null; current?: number; period?: string | null; dueDate?: string | null }

export async function listGoals(): Promise<Goal[]> {
  const { data } = await db().from("ceo_goals").select("id, title, metric, target, current, period, due_date, sort_order").order("sort_order");
  return ((data ?? []) as Array<Record<string, unknown>>).map((g) => ({
    id: String(g.id), title: String(g.title), metric: (g.metric as string) ?? null,
    target: g.target != null ? Number(g.target) : null, current: Number(g.current ?? 0),
    period: (g.period as string) ?? null, dueDate: (g.due_date as string) ?? null, sortOrder: Number(g.sort_order ?? 0),
  }));
}

export async function createGoal(input: GoalInput): Promise<{ id: string }> {
  const { data, error } = await db().from("ceo_goals").insert({
    business: "icapos", title: input.title, metric: input.metric ?? null, target: input.target ?? null,
    current: input.current ?? 0, period: input.period ?? null, due_date: input.dueDate ?? null,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return { id: String(data.id) };
}

export async function updateGoal(id: string, patch: Partial<GoalInput>): Promise<void> {
  const u: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) u.title = patch.title;
  if (patch.metric !== undefined) u.metric = patch.metric;
  if (patch.target !== undefined) u.target = patch.target;
  if (patch.current !== undefined) u.current = patch.current;
  if (patch.period !== undefined) u.period = patch.period;
  if (patch.dueDate !== undefined) u.due_date = patch.dueDate;
  const { error } = await db().from("ceo_goals").update(u).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await db().from("ceo_goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface NotificationPrefs { emailDaily: boolean; emailWeekly: boolean }

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data } = await db().from("ceo_notification_prefs").select("email_daily, email_weekly").eq("user_id", userId).maybeSingle();
  return { emailDaily: data?.email_daily ?? false, emailWeekly: data?.email_weekly ?? true };
}

export async function updateNotificationPrefs(userId: string, patch: Partial<NotificationPrefs>): Promise<void> {
  const u: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.emailDaily !== undefined) u.email_daily = patch.emailDaily;
  if (patch.emailWeekly !== undefined) u.email_weekly = patch.emailWeekly;
  const { error } = await db().from("ceo_notification_prefs").upsert(u, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
