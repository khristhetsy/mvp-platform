/**
 * Recurring social posts. A recurrence row stores the schedule rule + the post
 * template; occurrences are materialized (up to a rolling horizon) as normal scheduled
 * posts that publish through the queue. The occurrence generator is pure and tested;
 * the IO (create/materialize/pause/end) is server-only.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { syncPostEvent } from "@/lib/social/gcal-sync";
import { zoneOffsetMinutes } from "@/lib/cron/zoned-schedule";
import { PLATFORM_TZ } from "@/lib/time/platform-tz";

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

function addDaysYmd(s: string, days: number): string {
  const [y, m, d] = ymd(s);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Shift a rule's time of day by `deltaMin` minutes. When the shift crosses midnight the
 * weekdays and start/end dates move with it, so every future occurrence lands exactly
 * `deltaMin` later than it would have (matching the already-materialized posts).
 */
export function shiftRuleTime(rule: RecurrenceRule, deltaMin: number): RecurrenceRule {
  if (!deltaMin) return rule;
  const t = parseTime(rule.timeLocal);
  const total = t.h * 60 + t.m + deltaMin;
  const dayShift = Math.floor(total / 1440);
  const mins = ((total % 1440) + 1440) % 1440;
  const timeLocal = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  if (dayShift === 0) return { ...rule, timeLocal };
  return {
    ...rule,
    timeLocal,
    weekdays: rule.weekdays.map((w) => (((w + dayShift) % 7) + 7) % 7),
    startDate: addDaysYmd(rule.startDate, dayShift),
    endDate: rule.endDate ? addDaysYmd(rule.endDate, dayShift) : rule.endDate ?? null,
  };
}

// ── IO (server-only) ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type RecurrenceTemplate = {
  campaignId?: string | null; archetype?: string | null; department?: string | null; brief?: string | null;
  body: string; comment?: string | null; linkUrl?: string | null; imageUrl?: string | null;
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
    body: input.body ?? "", comment_text: input.comment ?? null, link_url: input.linkUrl ?? null, image_url: input.imageUrl ?? null,
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
    brief: row.brief as string | null, body: (row.body as string) ?? "", comment: row.comment_text as string | null, linkUrl: row.link_url as string | null, imageUrl: (row.image_url as string | null) ?? null,
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
    body: template.variants[0]?.body ?? template.body ?? "", comment_text: template.comment ?? null, link_url: template.linkUrl ?? null, image_url: template.imageUrl ?? null,
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
    // For "following", cut off at the clicked post's own scheduled time (read from the DB
    // so we don't depend on the client's date format); fall back to the passed value.
    let cutoff = opts.fromISO ?? null;
    if (scope === "following" && opts.postId) {
      const { data: p } = await db().from("social_posts").select("scheduled_at").eq("id", opts.postId).maybeSingle();
      if (p?.scheduled_at) cutoff = p.scheduled_at as string;
    }
    let q = db().from("social_posts").select("id").eq("recurrence_id", recurrenceId);
    if (scope === "following" && cutoff) q = q.gte("scheduled_at", cutoff);
    const { data } = await q;
    ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
    // Ensure the clicked post is included even if its scheduled_at is null (already published).
    if (scope === "following" && opts.postId && !ids.includes(opts.postId)) ids.push(opts.postId);
  }
  if (ids.length) await db().from("social_posts").delete().in("id", ids);
  if (scope !== "this") {
    await db().from("social_recurrences").update({ status: "ended", next_run: null, updated_at: new Date().toISOString() }).eq("id", recurrenceId);
  }
  return ids.length;
}

/** Series summary for a post's recurrence (for the Schedule detail card). */
export async function recurrenceSummary(id: string): Promise<{ id: string; status: string; label: string; madeCount: number; accountIds: string[] } | null> {
  const { data: row } = await db().from("social_recurrences").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  // Rules run in UTC on the server; show them in Pacific time (same moments).
  const rule = shiftRuleTime(ruleFromRow(row), zoneOffsetMinutes(new Date(), PLATFORM_TZ));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const every = rule.interval > 1 ? `every ${rule.interval} ` : "";
  const base = rule.freq === "weekly"
    ? `Repeats ${every}week${rule.interval > 1 ? "s" : ""}${rule.weekdays.length ? " · " + rule.weekdays.map((d) => days[d]).join(" & ") : ""}`
    : rule.freq === "daily" ? `Repeats ${every}day${rule.interval > 1 ? "s" : ""}` : `Repeats ${every}month${rule.interval > 1 ? "s" : ""}`;
  const end = rule.endType === "on_date" && rule.endDate ? ` until ${rule.endDate}` : rule.endType === "after" ? ` · ${rule.endCount} posts` : "";
  return { id: row.id, status: row.status, label: `${base} at ${rule.timeLocal} PT${end}`, madeCount: row.made_count ?? 0, accountIds: ((row.account_ids as string[] | null) ?? []) };
}

/** Variant states that are already live or in flight, so a series edit leaves them alone. */
const LOCKED_VARIANT_STATUSES = ["published", "publishing", "interrupted", "archived"];

export type SeriesEditScope = "this" | "following" | "all";
export type SeriesEditResult = { ok: true; updated: number; skipped: number } | { ok: false; error: string };

/**
 * Edit series posts by scope (Google-style), mirroring deleteSeriesPosts:
 *   this       → just the clicked post
 *   following  → the clicked post + every later occurrence; future occurrences follow the template
 *   all        → every post in the series; future occurrences follow the template
 * `body` replaces the copy for the clicked variant's account. `deltaMin` moves the time of
 * day for every variant of the affected posts. Published / in-flight variants are skipped.
 */
export async function editSeriesPosts(
  recurrenceId: string,
  scope: SeriesEditScope,
  opts: { variantId: string; body?: string | null; deltaMin?: number | null; userId?: string | null },
  now = new Date(),
): Promise<SeriesEditResult> {
  const body = opts.body?.trim() || null;
  const deltaMin = opts.deltaMin ? Math.trunc(opts.deltaMin) : 0;
  if (!body && !deltaMin) return { ok: true, updated: 0, skipped: 0 };
  const deltaMs = deltaMin * 60000;

  const { data: clicked } = await db().from("social_variants")
    .select("id, post_id, account_id, post:social_posts(recurrence_id, scheduled_at)").eq("id", opts.variantId).maybeSingle();
  const cp = clicked?.post as { recurrence_id: string | null; scheduled_at: string | null } | null;
  if (!clicked || cp?.recurrence_id !== recurrenceId) return { ok: false, error: "That post isn't part of this series." };
  const accountId = clicked.account_id as string;

  // Which posts are in scope.
  let postIds: string[] = [];
  if (scope === "this") postIds = [clicked.post_id as string];
  else {
    let q = db().from("social_posts").select("id").eq("recurrence_id", recurrenceId);
    if (scope === "following" && cp?.scheduled_at) q = q.gte("scheduled_at", cp.scheduled_at);
    const { data } = await q;
    postIds = ((data ?? []) as { id: string }[]).map((r) => r.id);
    if (!postIds.includes(clicked.post_id as string)) postIds.push(clicked.post_id as string);
  }

  const { data: vrows } = await db().from("social_variants")
    .select("id, post_id, account_id, status, body, scheduled_at, gcal_event_id").in("post_id", postIds);
  type V = { id: string; post_id: string; account_id: string; status: string; body: string; scheduled_at: string | null; gcal_event_id: string | null };
  const all = (vrows ?? []) as V[];
  const editable = all.filter((v) => !LOCKED_VARIANT_STATUSES.includes(v.status));
  const skipped = new Set(all.filter((v) => LOCKED_VARIANT_STATUSES.includes(v.status)).map((v) => v.post_id)).size;

  if (deltaMs) {
    const intoPast = editable.some((v) => v.scheduled_at && new Date(v.scheduled_at).getTime() + deltaMs <= now.getTime());
    if (intoPast) return { ok: false, error: "That time would move a scheduled post into the past. Pick a later time or edit only the following posts." };
  }

  const stamp = new Date().toISOString();
  const touchedPosts = new Set<string>();
  const calendarJobs: (() => Promise<unknown>)[] = [];
  for (const v of editable) {
    const patch: Record<string, unknown> = { updated_at: stamp };
    const newBody = body && v.account_id === accountId ? body : null;
    if (newBody) patch.body = newBody;
    let startISO = v.scheduled_at;
    if (deltaMs && v.scheduled_at) {
      startISO = new Date(new Date(v.scheduled_at).getTime() + deltaMs).toISOString();
      patch.scheduled_at = startISO;
      if (v.status === "queued") patch.next_attempt_at = startISO;
    }
    if (Object.keys(patch).length === 1) continue;
    const { error } = await db().from("social_variants").update(patch).eq("id", v.id);
    if (error) return { ok: false, error: error.message };
    touchedPosts.add(v.post_id);
    if (v.gcal_event_id && startISO && opts.userId) {
      const notes = newBody ?? v.body;
      const eventId = v.gcal_event_id;
      calendarJobs.push(() => syncPostEvent({ userId: opts.userId!, existingEventId: eventId, title: (notes || "Social post").split("\n")[0].slice(0, 80), startISO: startISO!, notes }));
    }
  }

  // Keep the parent post rows in step (post.body mirrors the first variant's copy).
  const { data: rec } = await db().from("social_recurrences").select("*").eq("id", recurrenceId).maybeSingle();
  const tmplVariants = ((rec?.variants as { accountId: string; body: string }[]) ?? []);
  const isLead = !tmplVariants.length || tmplVariants[0].accountId === accountId;
  if (touchedPosts.size) {
    const { data: prow } = await db().from("social_posts").select("id, scheduled_at").in("id", [...touchedPosts]);
    for (const p of (prow ?? []) as { id: string; scheduled_at: string | null }[]) {
      const patch: Record<string, unknown> = {};
      if (body && isLead) patch.body = body;
      if (deltaMs && p.scheduled_at) patch.scheduled_at = new Date(new Date(p.scheduled_at).getTime() + deltaMs).toISOString();
      if (Object.keys(patch).length) await db().from("social_posts").update(patch).eq("id", p.id);
    }
  }

  // Future occurrences: update the series template so new posts get the change too.
  if (scope !== "this" && rec) {
    const patch: Record<string, unknown> = { updated_at: stamp };
    if (body) {
      patch.variants = tmplVariants.map((tv) => (tv.accountId === accountId ? { ...tv, body } : tv));
      if (isLead) patch.body = body;
    }
    if (deltaMs) {
      const shifted = shiftRuleTime(ruleFromRow(rec), deltaMin);
      patch.time_local = shifted.timeLocal;
      patch.weekdays = shifted.weekdays;
      patch.start_date = shifted.startDate;
      patch.end_date = shifted.endDate ?? null;
      if (rec.next_run) patch.next_run = new Date(new Date(rec.next_run as string).getTime() + deltaMs).toISOString();
    }
    const { error } = await db().from("social_recurrences").update(patch).eq("id", recurrenceId);
    if (error) return { ok: false, error: error.message };
  }

  // Mirror onto Google Calendar, a few at a time; a calendar hiccup never fails the edit.
  for (let i = 0; i < calendarJobs.length; i += 5) await Promise.allSettled(calendarJobs.slice(i, i + 5).map((j) => j()));

  return { ok: true, updated: touchedPosts.size, skipped };
}
