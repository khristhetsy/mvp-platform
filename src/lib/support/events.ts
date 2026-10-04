/**
 * The support activity log. One row per step on a request: what the founder
 * did, what the AI did (with its token count and cost), what staff did, and
 * what the system sent. Read on Admin, Customer Support, Support log.
 * Writes are best effort and never break the action they record.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type SupportActor = "founder" | "ai" | "staff" | "system" | "alert";

export type SupportEventKind =
  | "submitted"
  | "assigned"
  | "reassigned"
  | "confirmation_sent"
  | "staff_notified"
  | "founder_reply"
  | "staff_reply"
  | "founder_notified"
  | "reminder"
  | "due_soon"
  | "overdue"
  | "founder_nudged"
  | "ai_triage"
  | "ai_handoff"
  | "ai_answer"
  | "ai_answer_solved"
  | "ai_answer_needs_person"
  | "ai_draft"
  | "ai_summary"
  | "resolved"
  | "confirm_sent"
  | "confirm_reminder"
  | "founder_confirmed"
  | "founder_reopened"
  | "rated"
  | "closed";

export type AiCost = { model: string; inputTokens: number; outputTokens: number; costUsd: number };

export type SupportEventInput = {
  requestId: string | null;
  founderId?: string | null;
  actor: SupportActor;
  actorUserId?: string | null;
  kind: SupportEventKind;
  summary: string;
  detail?: string | null;
  meta?: Record<string, unknown> | null;
  ai?: AiCost | null;
};

export type SupportEventRow = {
  id: string;
  request_id: string | null;
  founder_id: string | null;
  actor: SupportActor;
  actor_user_id: string | null;
  kind: SupportEventKind;
  summary: string;
  detail: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function logSupportEvent(input: SupportEventInput): Promise<void> {
  try {
    const meta = { ...(input.meta ?? {}), ...(input.ai ? { ai: input.ai } : {}) };
    await db().from("support_events").insert({
      request_id: input.requestId,
      founder_id: input.founderId ?? null,
      actor: input.actor,
      actor_user_id: input.actorUserId ?? null,
      kind: input.kind,
      summary: input.summary.slice(0, 300),
      detail: input.detail ? input.detail.slice(0, 4000) : null,
      meta: Object.keys(meta).length ? meta : null,
    });
  } catch {
    /* the log never blocks the action */
  }
}

export async function listRequestEvents(requestId: string): Promise<SupportEventRow[]> {
  try {
    const { data } = await db()
      .from("support_events")
      .select("id, request_id, founder_id, actor, actor_user_id, kind, summary, detail, meta, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true })
      .limit(500);
    return (data ?? []) as SupportEventRow[];
  } catch {
    return [];
  }
}

/** AI cost recorded on the log rows, in USD. */
export function aiCostOf(rows: Array<Pick<SupportEventRow, "meta">>): number {
  let total = 0;
  for (const r of rows) {
    const ai = (r.meta as { ai?: { costUsd?: number } } | null)?.ai;
    if (ai && typeof ai.costUsd === "number") total += ai.costUsd;
  }
  return total;
}
