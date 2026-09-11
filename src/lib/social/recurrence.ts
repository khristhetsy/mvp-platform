/**
 * Recurring social posts. A recurrence row stores the schedule rule + the post
 * template; occurrences are materialized (up to a rolling horizon) as normal scheduled
 * posts that publish through the queue. The occurrence generator is pure and tested;
 * the IO (create/materialize/pause/end) is server-only.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type Freq = "daily" | "weekly" | "monthly";
export type EndType = "never" | "on_date" | "after";

export type RecurrenceRule = {
  freq: Freq;
  interval: number;          // every N days/weeks/months
  weekdays: number[];        // 0=Sun..6=Sat, used when freq==='weekly'
  timeLocal: string;         // "HH:MM"
  startDate: string;         // "YYYY-MM-DD"
  endType: EndType;
  endDate?: string | null;   // "YYYY-MM-DD" when endType==='on_date'
  endCount?: number | null;  // when endType==='after'
};

/** How far ahead occurrences are pre-created (the cron tops up as time passes). */
export const MATERIALIZE_HORIZON_DAYS = 45;

// ── Pure occurrence generation ─────────────────────────────────────────────────

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}
function ymd(s: string): [number, number, number] {
  const [y, mo, d] = s.split("-").map((n) => parseInt(n, 10));
  return [y, mo, d];
}

/**
 * Ordered occurrence timestamps (ms, local time) for a rule, from its start date,
 * respecting the end condition. `never` is capped by horizonDays; a hard cap guards
 * against runaway loops.
 */
export function generateOccurrences(rule: RecurrenceRule, opts: { limit?: number; horizonDays?: number } = {}): number[] {
  const t = parseTime(rule.timeLocal);
  const [sy, sm, sd] = ymd(rule.startDate);
  const start = new Date(sy, sm - 1, sd, t.h, t.m, 0, 0);
  const interval = Math.max(1, rule.interval || 1);
  const HARD_CAP = 500;
  const limit = Math.min(opts.limit ?? HARD_CAP, HARD_CAP);
  const horizonMs = start.getTime() + (opts.horizonDays ?? 400) * 86400000;
  const endDateMs = rule.endType === "on_date" && rule.endDate
    ? (() => { const [ey, em, ed] = ymd(rule.endDate); return new Date(ey, em - 1, ed, 23, 59, 59, 999).getTime(); })()
    : null;
  const endCount = rule.endType === "after" ? (rule.endCount ?? 0) : null;
  const out: number[] = [];
  const overLimit = () => (endCount !== null && out.length >= endCount) || out.length >= HARD_CAP;
  const pastBounds = (ms: number) => (endDateMs !== null && ms > endDateMs) || (rule.endType === "never" && ms > horizonMs);

  if (rule.freq === "daily") {
    let d = new Date(start);
    while (!overLimit()) {
      const ms = d.getTime();
      if (pastBounds(ms)) break;
      out.push(ms);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + interval, t.h, t.m, 0, 0);
    }
  } else if (rule.freq === "weekly") {
    const wds = rule.weekdays.length ? [...new Set(rule.weekdays)] : [start.getDay()];
    const startWeek = new Date(start); startWeek.setDate(start.getDate() - start.getDay()); startWeek.setHours(0, 0, 0, 0);
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), t.h, t.m, 0, 0);
    let guard = 0;
    while (!overLimit() && guard < 4000) {
      guard++;
      const ms = cursor.getTime();
      if (pastBounds(ms)) break;
      const cw = new Date(cursor); cw.setDate(cursor.getDate() - cursor.getDay()); cw.setHours(0, 0, 0, 0);
      const weekDiff = Math.round((cw.getTime() - startWeek.getTime()) / (7 * 86400000));
      if (wds.includes(cursor.getDay()) && weekDiff >= 0 && weekDiff % interval === 0 && ms >= start.getTime()) out.push(ms);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, t.h, t.m, 0, 0);
    }
  } else { // monthly
    let i = 0;
    while (!overLimit() && i < 600) {
      const d = new Date(start.getFullYear(), start.getMonth() + i * interval, sd, t.h, t.m, 0, 0);
      const ms = d.getTime();
      if (pastBounds(ms)) break;
      out.push(ms);
      i++;
    }
  }
  return out.slice(0, limit);
}

/** The first occurrence strictly after `afterMs`, or null. */
export function nextAfter(rule: RecurrenceRule, afterMs: number): number | null {
  for (const ms of generateOccurrences(rule)) if (ms > afterMs) return ms;
  return null;
}

/** Up to `n` upcoming occurrences at/after `fromMs` — for the composer preview. */
export function upcoming(rule: RecurrenceRule, fromMs: number, n = 6): number[] {
  return generateOccurrences(rule).filter((ms) => ms >= fromMs).slice(0, n);
}

/** Total occurrences a rule will ever produce (capped), for the preview count. */
export function totalCount(rule: RecurrenceRule): number {
  return generateOccurrences(rule).length;
}

// ── IO (server-only) ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type RecurrenceTemplate = {
  campaignId?: string | null; archetype?: string | null; department?: string | null; brief?: string | null;
  body: string; comment?: string | null; linkUrl?: string | null;
  variants: { accountId: string; body: string }[];
};

export type RecurrenceRow = RecurrenceRule & RecurrenceTemplate & { id: string; status: "active" | "paused" | "ended"; next_run: string | null; made_count: number };

function ruleFromRow(r: Record<string, unknown>): RecurrenceRule {
  return {
    freq: r.freq as Freq, interval: (r.interval_n as number) ?? 1, weekdays: (r.weekdays as number[]) ?? [],
    timeLocal: (r.time_local as string) ?? "08:15", startDate: String(r.start_date).slice(0, 10),
    endType: (r.end_type as EndType) ?? "never", endDate: (r.end_date as string) ?? null, endCount: (r.end_count as number) ?? null,
  };
}

export async function createRecurrence(input: RecurrenceRule & RecurrenceTemplate & { createdBy?: string | null }, now = new Date()): Promise<{ id: string } | null> {
  const first = generateOccurrences(input)[0] ?? null;
  const { data, error } = await db().from("social_recurrences").insert({
    freq: input.freq, interval_n: Math.max(1, input.interval || 1), weekdays: input.weekdays ?? [], time_local: input.timeLocal,
    start_date: input.startDate, end_type: input.endType, end_date: input.endDate ?? null, end_count: input.endCount ?? null,
    status: "active", next_run: first ? new Date(first).toISOString() : null, made_count: 0,
    campaign_id: input.campaignId ?? null, archetype: input.archetype ?? null, department: input.department ?? null, brief: input.brief ?? null,
    body: input.body ?? "", comment_text: input.comment ?? null, link_url: input.linkUrl ?? null,
    account_ids: input.variants.map((v) => v.accountId), variants: input.variants, created_by: input.createdBy ?? null,
  }).select("id").single();
  if (error || !data) return null;
  // Fill the near-term occurrences immediately so they show on the calendar.
  await materializeRecurrence(data.id, now);
  return { id: data.id };
}

/** Create scheduled posts for all due occurrences of one recurrence, advancing next_run. */
export async function materializeRecurrence(id: string, now = new Date()): Promise<number> {
  const { data: row } = await db().from("social_recurrences").select("*").eq("id", id).maybeSingle();
  if (!row || row.status !== "active") return 0;
  const rule = ruleFromRow(row);
  const template = {
    campaignId: row.campaign_id as string | null, archetype: row.archetype as string | null, department: row.department as string | null,
    brief: row.brief as string | null, body: (row.body as string) ?? "", comment: row.comment_text as string | null, linkUrl: row.link_url as string | null,
    variants: ((row.variants as { accountId: string; body: string }[]) ?? []),
  };
  const horizonMs = now.getTime() + MATERIALIZE_HORIZON_DAYS * 86400000;
  let created = 0;
  let nextRunMs = row.next_run ? new Date(row.next_run).getTime() : null;
  while (nextRunMs !== null && nextRunMs <= horizonMs) {
    await createOccurrencePost(id, template, new Date(nextRunMs), row.created_by as string | null);
    created++;
    nextRunMs = nextAfter(rule, nextRunMs);
  }
  await db().from("social_recurrences").update({
    next_run: nextRunMs !== null ? new Date(nextRunMs).toISOString() : null,
    status: nextRunMs === null ? "ended" : "active",
    made_count: (row.made_count ?? 0) + created,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  return created;
}

async function createOccurrencePost(recurrenceId: string, template: RecurrenceTemplate, when: Date, createdBy: string | null): Promise<void> {
  const iso = when.toISOString();
  const { data: post } = await db().from("social_posts").insert({
    archetype: template.archetype ?? null, brief: template.brief ?? null, department: template.department ?? null,
    campaign_id: template.campaignId ?? null, recurrence_id: recurrenceId,
    body: template.variants[0]?.body ?? template.body ?? "", comment_text: template.comment ?? null, link_url: template.linkUrl ?? null,
    status: "scheduled", scheduled_at: iso, created_by: createdBy,
  }).select("id").single();
  if (!post) return;
  const rows = template.variants.map((v) => ({
    post_id: post.id, account_id: v.accountId, body: v.body, comment_text: template.comment ?? null,
    status: "queued", scheduled_at: iso, next_attempt_at: iso, idempotency_key: `${post.id}:${v.accountId}`,
  }));
  if (rows.length) await db().from("social_variants").insert(rows);
}

/** Cron entry: materialize every active recurrence whose next occurrence is within the horizon. */
export async function materializeDueRecurrences(now = new Date()): Promise<{ recurrences: number; created: number }> {
  const horizonISO = new Date(now.getTime() + MATERIALIZE_HORIZON_DAYS * 86400000).toISOString();
  const { data } = await db().from("social_recurrences").select("id").eq("status", "active").not("next_run", "is", null).lte("next_run", horizonISO);
  let created = 0;
  const rows = (data ?? []) as { id: string }[];
  for (const r of rows) created += await materializeRecurrence(r.id, now);
  return { recurrences: rows.length, created };
}

export async function setRecurrenceStatus(id: string, status: "active" | "paused" | "ended", now = new Date()): Promise<boolean> {
  const { error } = await db().from("social_recurrences").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return false;
  if (status === "active") await materializeRecurrence(id, now); // resume → top up
  return true;
}

/**
 * Delete series posts by scope (Google-style). Variants cascade on post delete.
 *   this       → just the one post (postId)
 *   following  → this post + all later occurrences (scheduled_at >= fromISO); ends series
 *   all        → every post in the series; ends series
 * Returns how many posts were deleted.
 */
export async function deleteSeriesPosts(recurrenceId: string, scope: "this" | "following" | "all", opts: { postId?: string | null; fromISO?: string | null }): Promise<number> {
  let ids: string[] = [];
  if (scope === "this") {
    if (!opts.postId) return 0;
    ids = [opts.postId];
  } else {
    let q = db().from("social_posts").select("id").eq("recurrence_id", recurrenceId);
    if (scope === "following" && opts.fromISO) q = q.gte("scheduled_at", opts.fromISO);
    const { data } = await q;
    ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  }
  if (ids.length) await db().from("social_posts").delete().in("id", ids);
  if (scope !== "this") {
    await db().from("social_recurrences").update({ status: "ended", next_run: null, updated_at: new Date().toISOString() }).eq("id", recurrenceId);
  }
  return ids.length;
}

/** Series summary for a post's recurrence (for the Schedule detail card). */
export async function recurrenceSummary(id: string): Promise<{ id: string; status: string; label: string; madeCount: number } | null> {
  const { data: row } = await db().from("social_recurrences").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const rule = ruleFromRow(row);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const every = rule.interval > 1 ? `every ${rule.interval} ` : "";
  const base = rule.freq === "weekly"
    ? `Repeats ${every}week${rule.interval > 1 ? "s" : ""}${rule.weekdays.length ? " · " + rule.weekdays.map((d) => days[d]).join(" & ") : ""}`
    : rule.freq === "daily" ? `Repeats ${every}day${rule.interval > 1 ? "s" : ""}` : `Repeats ${every}month${rule.interval > 1 ? "s" : ""}`;
  const end = rule.endType === "on_date" && rule.endDate ? ` until ${rule.endDate}` : rule.endType === "after" ? ` · ${rule.endCount} posts` : "";
  return { id: row.id, status: row.status, label: `${base} at ${rule.timeLocal}${end}`, madeCount: row.made_count ?? 0 };
}
