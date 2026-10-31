/**
 * Data access for the daily queue. Service role, staff routes and pages only.
 *
 * The queue for a day is built once, the first time anyone opens it that day,
 * from a handful of bounded queries over the open opportunities in the five
 * active stages (a few hundred rows). After that the page only reads the stored
 * rows, so a page view never recounts or rescans. The ranking itself is in queue.ts.
 */
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { addDays, dayKey, rankQueue, type QueueCandidate, type QueueReason } from "./queue";
import { isAgentStage } from "./stages";

const db = () => serviceRoleClientUntyped();
const CHUNK = 150;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type Row = Record<string, unknown>;

async function inChunks(ids: string[], run: (part: string[]) => PromiseLike<{ data: unknown }>): Promise<Row[]> {
  const results = await Promise.all(chunks(ids).map((part) => run(part)));
  return results.flatMap((r) => (Array.isArray(r.data) ? (r.data as Row[]) : []));
}

/** Everything the ranking needs for the open opportunities in the active stages. */
async function gatherCandidates(day: string): Promise<QueueCandidate[]> {
  const { data: stageRows } = await db().from("sales_stages").select("id, name, sort_order, is_won");
  const stages = (stageRows ?? []) as Array<{ id: string; name: string; sort_order: number; is_won: boolean }>;
  const active = stages.filter(isAgentStage);
  if (!active.length) return [];
  const stageName = new Map(active.map((s) => [s.id, s.name]));

  const { data: oppRows } = await db()
    .from("sales_opportunities")
    .select("id, stage_id, created_at")
    .eq("status", "open")
    .in("stage_id", active.map((s) => s.id))
    .limit(2000);
  const opps = (oppRows ?? []) as Array<{ id: string; stage_id: string; created_at: string }>;
  if (!opps.length) return [];
  const ids = opps.map((o) => o.id);

  const [logs, assignments, drafts, suggestions, snoozes] = await Promise.all([
    inChunks(ids, (p) => db().from("sales_activity_log").select("opportunity_id, created_at").in("opportunity_id", p).order("created_at", { ascending: false }).limit(5000)),
    inChunks(ids, (p) => db().from("sales_ai_assignments").select("opportunity_id, chat_tag").in("opportunity_id", p)),
    inChunks(ids, (p) => db().from("sales_ai_drafts").select("opportunity_id, status, sent_at").in("opportunity_id", p).in("status", ["draft", "sent"])),
    inChunks(ids, (p) => db().from("sales_ai_stage_suggestions").select("opportunity_id").in("opportunity_id", p).eq("status", "pending")),
    inChunks(ids, (p) => db().from("sales_ai_queue_items").select("opportunity_id").in("opportunity_id", p).gte("snoozed_until", day)),
  ]);

  const lastActivity = new Map<string, string>();
  for (const r of logs) {
    const id = String(r.opportunity_id);
    if (!lastActivity.has(id)) lastActivity.set(id, String(r.created_at)); // newest first
  }

  const tagOf = new Map(assignments.map((a) => [String(a.opportunity_id), String(a.chat_tag)]));
  const convRows = tagOf.size ? await inChunks([...tagOf.values()], (p) => db().from("ir_agent_conversations").select("source, updated_at").in("source", p)) : [];
  const chat = new Map<string, { count: number; last: string }>();
  for (const r of convRows) {
    const tag = String(r.source);
    const prev = chat.get(tag);
    const at = String(r.updated_at);
    chat.set(tag, { count: (prev?.count ?? 0) + 1, last: prev && prev.last > at ? prev.last : at });
  }

  const lastEmail = new Map<string, string>();
  const openDraft = new Set<string>();
  for (const d of drafts) {
    const id = String(d.opportunity_id);
    if (d.status === "draft") openDraft.add(id);
    if (d.status === "sent" && d.sent_at) {
      const at = String(d.sent_at);
      if (!lastEmail.has(id) || (lastEmail.get(id) as string) < at) lastEmail.set(id, at);
    }
  }
  const pending = new Map<string, number>();
  for (const s of suggestions) pending.set(String(s.opportunity_id), (pending.get(String(s.opportunity_id)) ?? 0) + 1);
  const snoozed = new Set(snoozes.map((s) => String(s.opportunity_id)));

  return opps.map((o) => {
    const c = chat.get(tagOf.get(o.id) ?? "");
    return {
      id: o.id,
      stageName: stageName.get(o.stage_id) ?? "",
      createdAt: o.created_at,
      lastActivityAt: lastActivity.get(o.id) ?? null,
      pendingSuggestions: pending.get(o.id) ?? 0,
      chatCount: c?.count ?? 0,
      lastChatAt: c?.last ?? null,
      lastEmailSentAt: lastEmail.get(o.id) ?? null,
      openDraft: openDraft.has(o.id),
      snoozed: snoozed.has(o.id),
    };
  });
}

// When a day's queue comes out empty there is nothing to store, so remember the attempt
// for a few minutes instead of rebuilding on every page view.
let lastEmptyBuild = 0;
const EMPTY_RETRY_MS = 10 * 60_000;

/** Builds today's queue if nobody has yet. Safe to call on every page view. */
export async function ensureQueue(now = new Date()): Promise<void> {
  const day = dayKey(now);
  const { data: existing } = await db().from("sales_ai_queue_items").select("id").eq("day", day).limit(1);
  if ((existing ?? []).length) return;
  if (now.getTime() - lastEmptyBuild < EMPTY_RETRY_MS) return;

  const entries = rankQueue(await gatherCandidates(day), now);
  if (!entries.length) {
    lastEmptyBuild = now.getTime();
    return;
  }
  await db()
    .from("sales_ai_queue_items")
    .upsert(
      entries.map((e) => ({ day, opportunity_id: e.opportunityId, rank: e.rank, score: e.score, reasons: e.reasons, stage_name: e.stageName })),
      { onConflict: "day,opportunity_id", ignoreDuplicates: true },
    );
}

export type QueueItem = {
  id: string;
  opportunityId: string;
  title: string;
  contactName: string | null;
  stageName: string;
  rank: number;
  reasons: QueueReason[];
};

/** Today's open items, in order, with the opportunity's title and contact. */
export async function readQueue(now = new Date()): Promise<{ day: string; items: QueueItem[] }> {
  const day = dayKey(now);
  const { data } = await db().from("sales_ai_queue_items").select("id, opportunity_id, rank, reasons, stage_name").eq("day", day).eq("status", "open").order("rank");
  const rows = (data ?? []) as Array<{ id: string; opportunity_id: string; rank: number; reasons: QueueReason[] | null; stage_name: string | null }>;
  if (!rows.length) return { day, items: [] };
  const opps = await inChunks(rows.map((r) => r.opportunity_id), (p) => db().from("sales_opportunities").select("id, title, contact_name").in("id", p));
  const byId = new Map(opps.map((o) => [String(o.id), o]));
  return {
    day,
    items: rows.map((r) => ({
      id: r.id,
      opportunityId: r.opportunity_id,
      title: String(byId.get(r.opportunity_id)?.title ?? "Opportunity"),
      contactName: (byId.get(r.opportunity_id)?.contact_name as string | null) ?? null,
      stageName: r.stage_name ?? "",
      rank: r.rank,
      reasons: Array.isArray(r.reasons) ? r.reasons : [],
    })),
  };
}

export const SNOOZE_DAYS = 3;

/** Skip hides it for today. Snooze also keeps it out of the next few days' queues. */
export async function decideQueueItem(itemId: string, action: "skip" | "snooze", userId: string, now = new Date()): Promise<void> {
  const update =
    action === "snooze"
      ? { status: "snoozed", snoozed_until: addDays(dayKey(now), SNOOZE_DAYS) }
      : { status: "skipped" };
  const { error } = await db()
    .from("sales_ai_queue_items")
    .update({ ...update, decided_by: userId, decided_at: now.toISOString() })
    .eq("id", itemId)
    .eq("status", "open");
  if (error) throw new Error(error.message);
}
