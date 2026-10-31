/**
 * Data access for the sales AI agent. Service role, staff routes only.
 * The sales_ai_* tables are not in the generated Supabase types yet, so the
 * untyped client is used, as the ir-agent store does.
 */
import { randomBytes } from "node:crypto";
import { agentUrl } from "@/lib/ir-agent/slug";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import type { ChatConv } from "./audit";
import type { AgentOption, Audit, DraftParts, DraftStatus, Objection, SalesAiDraft, StageSuggestion } from "./types";

const db = () => serviceRoleClientUntyped();

/* ---------- agents (the AI Agent module) ---------- */

type AgentRow = { id: string; company_name: string; display_name: string | null; agent_type: string | null; status: string; company_slug: string; ending: string };

export async function listAgentRows(): Promise<AgentRow[]> {
  const { data } = await db()
    .from("ir_agents")
    .select("id, company_name, display_name, agent_type, status, company_slug, ending")
    .is("archived_at", null)
    .order("created_at");
  return (data ?? []) as AgentRow[];
}

export function toAgentOption(a: AgentRow): AgentOption {
  return { id: a.id, name: a.display_name?.trim() || a.company_name, companyName: a.company_name, agentType: a.agent_type ?? "founder", live: a.status === "live" };
}

/** The chat link a prospect gets. ?src=<tag> is how the conversation finds its way back to the opportunity. */
export function chatUrlFor(agent: Pick<AgentRow, "company_slug" | "ending" | "status">, chatTag: string): string | null {
  return agent.status === "live" ? `${agentUrl(agent.company_slug, agent.ending)}?src=${chatTag}` : null;
}

/* ---------- assignment ---------- */

export type Assignment = { agentId: string | null; chatTag: string };

export async function getAssignment(opportunityId: string): Promise<Assignment | null> {
  const { data } = await db().from("sales_ai_assignments").select("agent_id, chat_tag").eq("opportunity_id", opportunityId).maybeSingle();
  const r = data as { agent_id: string | null; chat_tag: string } | null;
  return r ? { agentId: r.agent_id, chatTag: r.chat_tag } : null;
}

export async function saveAssignment(opportunityId: string, agentId: string | null, userId: string): Promise<Assignment> {
  const existing = await getAssignment(opportunityId);
  const chatTag = existing?.chatTag ?? `opp-${randomBytes(5).toString("hex")}`;
  const { error } = await db()
    .from("sales_ai_assignments")
    .upsert({ opportunity_id: opportunityId, agent_id: agentId, chat_tag: chatTag, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "opportunity_id" });
  if (error) throw new Error(error.message);
  return { agentId, chatTag };
}

/* ---------- chats ---------- */

export async function loadChats(agentId: string, chatTag: string): Promise<ChatConv[]> {
  const { data } = await db()
    .from("ir_agent_conversations")
    .select("id, transcript, booked_at, stopped, updated_at")
    .eq("agent_id", agentId)
    .eq("source", chatTag)
    .order("updated_at", { ascending: false })
    .limit(10);
  return ((data ?? []) as Array<{ id: string; transcript: unknown; booked_at: string | null; stopped: boolean; updated_at: string }>).map((r) => ({
    id: r.id,
    transcript: Array.isArray(r.transcript) ? (r.transcript as ChatConv["transcript"]).filter((m) => m && typeof m.content === "string") : [],
    booked: Boolean(r.booked_at),
    stopped: Boolean(r.stopped),
    updatedAt: r.updated_at,
  }));
}

/* ---------- drafts ---------- */

type DraftRow = {
  id: string; opportunity_id: string; agent_id: string | null; stage_id: string | null; objection: Objection; technique: string | null;
  audit: Audit; subject: string; body: string; body_parts: DraftParts | null; include_refund_offer: boolean; chat_url: string | null;
  status: DraftStatus; created_at: string; sent_at: string | null;
};

const DRAFT_COLS = "id, opportunity_id, agent_id, stage_id, objection, technique, audit, subject, body, body_parts, include_refund_offer, chat_url, status, created_at, sent_at";

function mapDraft(r: DraftRow): SalesAiDraft {
  return {
    id: r.id, opportunityId: r.opportunity_id, agentId: r.agent_id, stageId: r.stage_id, objection: r.objection, technique: r.technique,
    audit: r.audit, subject: r.subject, body: r.body, bodyParts: r.body_parts, includeRefundOffer: r.include_refund_offer,
    chatUrl: r.chat_url, status: r.status, createdAt: r.created_at, sentAt: r.sent_at,
  };
}

export async function latestOpenDraft(opportunityId: string): Promise<SalesAiDraft | null> {
  const { data } = await db()
    .from("sales_ai_drafts")
    .select(DRAFT_COLS)
    .eq("opportunity_id", opportunityId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapDraft(data as DraftRow) : null;
}

export async function getDraft(id: string): Promise<SalesAiDraft | null> {
  const { data } = await db().from("sales_ai_drafts").select(DRAFT_COLS).eq("id", id).maybeSingle();
  return data ? mapDraft(data as DraftRow) : null;
}

export async function insertDraft(input: {
  opportunityId: string; agentId: string | null; stageId: string | null; objection: Objection; technique: string; audit: Audit;
  subject: string; body: string; bodyParts: DraftParts; includeRefundOffer: boolean; chatUrl: string | null; userId: string;
}): Promise<SalesAiDraft> {
  // One open draft per opportunity: a new audit replaces the one before it.
  await db().from("sales_ai_drafts").update({ status: "discarded" }).eq("opportunity_id", input.opportunityId).eq("status", "draft");
  const { data, error } = await db()
    .from("sales_ai_drafts")
    .insert({
      opportunity_id: input.opportunityId, agent_id: input.agentId, stage_id: input.stageId, objection: input.objection, technique: input.technique,
      audit: input.audit, subject: input.subject, body: input.body, body_parts: input.bodyParts, include_refund_offer: input.includeRefundOffer,
      chat_url: input.chatUrl, created_by: input.userId,
    })
    .select(DRAFT_COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the draft.");
  return mapDraft(data as DraftRow);
}

export async function patchDraft(id: string, patch: { subject?: string; body?: string; bodyParts?: DraftParts | null; includeRefundOffer?: boolean; status?: DraftStatus; sentBy?: string }): Promise<SalesAiDraft> {
  const update: Record<string, unknown> = {};
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.bodyParts !== undefined) update.body_parts = patch.bodyParts;
  if (patch.includeRefundOffer !== undefined) update.include_refund_offer = patch.includeRefundOffer;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.status === "sent") {
    update.sent_at = new Date().toISOString();
    update.sent_by = patch.sentBy ?? null;
  }
  const { data, error } = await db().from("sales_ai_drafts").update(update).eq("id", id).select(DRAFT_COLS).single();
  if (error || !data) throw new Error(error?.message ?? "Could not update the draft.");
  return mapDraft(data as DraftRow);
}

/* ---------- stage suggestions ---------- */

type SuggestionRow = { id: string; opportunity_id: string; from_stage_id: string | null; to_stage_id: string; reason: string; source: string; status: StageSuggestion["status"]; created_at: string };

export async function listPendingSuggestions(opportunityId: string, stageNames: Map<string, string>): Promise<StageSuggestion[]> {
  const { data } = await db()
    .from("sales_ai_stage_suggestions")
    .select("id, opportunity_id, from_stage_id, to_stage_id, reason, source, status, created_at")
    .eq("opportunity_id", opportunityId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return ((data ?? []) as SuggestionRow[]).map((r) => ({
    id: r.id, opportunityId: r.opportunity_id, fromStageId: r.from_stage_id, toStageId: r.to_stage_id,
    toStageName: stageNames.get(r.to_stage_id) ?? "Unknown stage", reason: r.reason, source: r.source, status: r.status, createdAt: r.created_at,
  }));
}

/** Adds a suggestion unless one for the same stage and source was ever made, so a dismissed one stays dismissed. */
export async function addSuggestionOnce(input: { opportunityId: string; fromStageId: string | null; toStageId: string; reason: string; source: string; conversationId?: string | null }): Promise<void> {
  const { data } = await db()
    .from("sales_ai_stage_suggestions")
    .select("id")
    .eq("opportunity_id", input.opportunityId)
    .eq("to_stage_id", input.toStageId)
    .eq("source", input.source)
    .limit(1);
  if ((data ?? []).length) return;
  await db().from("sales_ai_stage_suggestions").insert({
    opportunity_id: input.opportunityId, from_stage_id: input.fromStageId, to_stage_id: input.toStageId,
    reason: input.reason, source: input.source, conversation_id: input.conversationId ?? null,
  });
}

export async function getSuggestion(id: string): Promise<SuggestionRow | null> {
  const { data } = await db().from("sales_ai_stage_suggestions").select("id, opportunity_id, from_stage_id, to_stage_id, reason, source, status, created_at").eq("id", id).maybeSingle();
  return (data as SuggestionRow | null) ?? null;
}

export async function decideSuggestion(id: string, status: "applied" | "dismissed", userId: string): Promise<void> {
  const { error } = await db()
    .from("sales_ai_stage_suggestions")
    .update({ status, decided_by: userId, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}
