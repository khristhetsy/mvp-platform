/**
 * Data for Admin, Customer Support, Support log: the request list with
 * outcomes, the four headline tiles, and one request's activity log.
 * Every figure is counted from stored rows; nothing is estimated.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { REQUEST_COLS, type SupportRequest } from "./support";
import { aiCostOf, listRequestEvents, type SupportEventRow } from "./events";

/* eslint-disable @typescript-eslint/no-explicit-any */
function svc(): SupabaseClient<any> {
  return createServiceRoleClient() as unknown as SupabaseClient<any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const SUPPORT_AI_FEATURES = ["support_assistant", "admin_support", "admin_support_triage"] as const;
export const ASSISTANT_KEY = "assistant";

export type LogRequestRow = {
  id: string;
  refNo: number | null;
  subject: string;
  companyName: string;
  founderName: string;
  ownerName: string | null;
  status: string;
  csat: number | null;
  rating: number | null;
  closedAt: string | null;
  createdAt: string;
  firstStaffReplyAt: string | null;
  staffReplies: number;
  viaAssistant: boolean;
  reopenedCount: number;
};

export type LogTiles = {
  medianFirstReplyMs: number | null;
  longestWaitMs: number | null;
  answered: number;
  onTime: number;
  onTimeOf: number;
  aiAnswers: number;
  aiSolved: number;
  aiNeedsPerson: number;
  aiCostMonthUsd: number;
};

export type SupportLogData = {
  requests: LogRequestRow[];
  tiles: LogTiles;
  assistantAnswers: number;
  selected: { key: string; events: SupportEventRow[]; aiCostUsd: number; names: Record<string, string> } | null;
};

const DAY = 86_400_000;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

export async function loadSupportLog(selectedKey: string | null): Promise<SupportLogData> {
  const now = Date.now();
  const since90 = new Date(now - 90 * DAY).toISOString();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const { data: reqData } = await svc().from("support_requests").select(REQUEST_COLS).order("created_at", { ascending: false }).limit(200);
  const reqs = (reqData ?? []) as SupportRequest[];
  const ids = reqs.map((r) => r.id);

  const [{ data: companies }, { data: people }, { data: staffMsgs }, { data: overdueEv }, { data: aiEv }, { data: spend }] = await Promise.all([
    reqs.length ? svc().from("companies").select("id, company_name").in("id", [...new Set(reqs.map((r) => r.company_id))]) : Promise.resolve({ data: [] }),
    reqs.length
      ? svc().from("profiles").select("id, full_name, email").in("id", [...new Set([...reqs.map((r) => r.founder_id), ...(reqs.map((r) => r.assigned_to).filter(Boolean) as string[])])])
      : Promise.resolve({ data: [] }),
    ids.length ? svc().from("support_messages").select("request_id").eq("author_role", "staff").in("request_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? svc().from("support_events").select("request_id").eq("kind", "overdue").in("request_id", ids) : Promise.resolve({ data: [] }),
    svc().from("support_events").select("kind").in("kind", ["ai_answer", "ai_answer_solved", "ai_answer_needs_person"]).gte("created_at", since30),
    svc().from("ai_spend_events").select("cost_usd").in("feature", [...SUPPORT_AI_FEATURES]).gte("created_at", monthStart),
  ]);

  const companyName = new Map(((companies ?? []) as Array<{ id: string; company_name: string | null }>).map((c) => [c.id, c.company_name ?? "Company"]));
  const personName = new Map(
    ((people ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [p.id, p.full_name?.trim() || p.email || "Unknown"]),
  );
  const staffReplies = new Map<string, number>();
  for (const m of (staffMsgs ?? []) as Array<{ request_id: string }>) staffReplies.set(m.request_id, (staffReplies.get(m.request_id) ?? 0) + 1);
  const missed = new Set(((overdueEv ?? []) as Array<{ request_id: string }>).map((e) => e.request_id));

  const requests: LogRequestRow[] = reqs.map((r) => ({
    id: r.id,
    refNo: r.ref_no ?? null,
    subject: r.subject,
    companyName: companyName.get(r.company_id) ?? "Company",
    founderName: personName.get(r.founder_id) ?? "Founder",
    ownerName: r.assigned_to ? personName.get(r.assigned_to) ?? null : null,
    status: r.status,
    csat: r.csat,
    rating: r.rating ?? null,
    closedAt: r.closed_at ?? null,
    createdAt: r.created_at,
    firstStaffReplyAt: r.first_staff_reply_at ?? null,
    staffReplies: staffReplies.get(r.id) ?? 0,
    viaAssistant: r.context_item === "Assistant",
    reopenedCount: r.reopened_count ?? 0,
  }));

  // Tiles: last 90 days of requests.
  const recent = requests.filter((r) => r.createdAt >= since90);
  const answered = recent.filter((r) => r.firstStaffReplyAt);
  const replyTimes = answered.map((r) => new Date(r.firstStaffReplyAt!).getTime() - new Date(r.createdAt).getTime());
  const waiting = recent.filter((r) => !r.firstStaffReplyAt && r.status !== "resolved");
  const longestWait = waiting.length ? Math.max(...waiting.map((r) => now - new Date(r.createdAt).getTime())) : null;
  // On time: answered with no missed promise, out of everything answered or already missed.
  const onTimeOf = recent.filter((r) => r.firstStaffReplyAt || missed.has(r.id)).length;
  const onTime = answered.filter((r) => !missed.has(r.id)).length;

  const aiKinds = ((aiEv ?? []) as Array<{ kind: string }>).map((e) => e.kind);
  const tiles: LogTiles = {
    medianFirstReplyMs: median(replyTimes),
    longestWaitMs: longestWait,
    answered: answered.length,
    onTime,
    onTimeOf,
    aiAnswers: aiKinds.filter((k) => k === "ai_answer").length,
    aiSolved: aiKinds.filter((k) => k === "ai_answer_solved").length,
    aiNeedsPerson: aiKinds.filter((k) => k === "ai_answer_needs_person").length,
    aiCostMonthUsd: ((spend ?? []) as Array<{ cost_usd: number | string | null }>).reduce((a, r) => a + Number(r.cost_usd ?? 0), 0),
  };

  let selected: SupportLogData["selected"] = null;
  const key = selectedKey ?? requests[0]?.id ?? null;
  if (key === ASSISTANT_KEY) {
    const { data } = await svc()
      .from("support_events")
      .select("id, request_id, founder_id, actor, actor_user_id, kind, summary, detail, meta, created_at")
      .is("request_id", null)
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(300);
    const events = (data ?? []) as SupportEventRow[];
    const names = await namesFor(events);
    selected = { key, events, aiCostUsd: aiCostOf(events), names };
  } else if (key && requests.some((r) => r.id === key)) {
    const events = await listRequestEvents(key);
    selected = { key, events, aiCostUsd: aiCostOf(events), names: await namesFor(events) };
  }

  return { requests, tiles, assistantAnswers: tiles.aiAnswers, selected };
}

async function namesFor(events: SupportEventRow[]): Promise<Record<string, string>> {
  const ids = [...new Set(events.flatMap((e) => [e.founder_id, e.actor_user_id]).filter(Boolean) as string[])];
  if (!ids.length) return {};
  const { data } = await svc().from("profiles").select("id, full_name, email").in("id", ids);
  return Object.fromEntries(
    ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((p) => [p.id, p.full_name?.trim() || p.email || "Unknown"]),
  );
}
