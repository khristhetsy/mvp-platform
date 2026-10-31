/**
 * The sales AI agent, end to end, for one opportunity.
 *
 * Reads the opportunity and everything said on it, prepares an audit and an
 * email for a person to review, and lists stage moves for a person to apply.
 * Nothing here sends an email or changes a stage by itself: sending goes through
 * the existing Sales chatter send route, and a move is applied only when a
 * person confirms it.
 */
import { isClaudeConfigured } from "@/lib/claude";
import { getOpportunity, updateOpportunity } from "@/lib/sales/opportunities";
import { loadTimeline } from "@/lib/sales/chatter";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildAudit, extractQuotes, threadText } from "./audit";
import { buildParts, renderBody, subjectFor, withRefund, writtenText } from "./draft";
import { draftViolations } from "./guards";
import { isAgentStage, stagePatchFor, suggestMoves, type StageLite } from "./stages";
import {
  addSuggestionOnce, chatUrlFor, decideSuggestion, getAssignment, getDraft, getSuggestion, insertDraft, latestOpenDraft,
  listAgentRows, listPendingSuggestions, loadChats, patchDraft, saveAssignment, toAgentOption,
} from "./store";
import type { DraftParts, SalesAiDraft, SalesAiState } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rawDb = (): any => createServiceRoleClient();

/** A message safe to show a person. */
export class SalesAiError extends Error {}

async function stagesFor(opportunityId: string): Promise<StageLite[]> {
  const { data: o } = await rawDb().from("sales_opportunities").select("pipeline_id").eq("id", opportunityId).maybeSingle();
  const pipelineId = (o?.pipeline_id as string | null) ?? null;
  if (!pipelineId) return [];
  const { data } = await rawDb().from("sales_stages").select("id, name, sort_order, is_won").eq("pipeline_id", pipelineId).order("sort_order");
  return (data ?? []) as StageLite[];
}

export async function getSalesAiState(opportunityId: string): Promise<SalesAiState | null> {
  const opp = await getOpportunity(opportunityId);
  if (!opp) return null;
  const [stages, assignment, agentRows, draft] = await Promise.all([stagesFor(opportunityId), getAssignment(opportunityId), listAgentRows(), latestOpenDraft(opportunityId)]);
  const current = stages.find((s) => s.id === opp.stage_id) ?? null;
  const agent = assignment?.agentId ? agentRows.find((a) => a.id === assignment.agentId) ?? null : null;
  const names = new Map(stages.map((s) => [s.id, s.name]));
  return {
    stageActive: Boolean(current && isAgentStage(current) && opp.status === "open"),
    stageName: current?.name ?? opp.stage_name,
    agentId: assignment?.agentId ?? null,
    chatTag: assignment?.chatTag ?? null,
    chatUrl: agent && assignment ? chatUrlFor(agent, assignment.chatTag) : null,
    agents: agentRows.map(toAgentOption),
    draft,
    suggestions: await listPendingSuggestions(opportunityId, names),
    aiConfigured: isClaudeConfigured(),
  };
}

export async function assignAgent(opportunityId: string, agentId: string | null, userId: string): Promise<void> {
  if (agentId) {
    const agents = await listAgentRows();
    if (!agents.some((a) => a.id === agentId)) throw new SalesAiError("That agent is not available.");
  }
  await saveAssignment(opportunityId, agentId, userId);
}

export async function createAuditDraft(opportunityId: string, userId: string, includeRefundOffer: boolean): Promise<SalesAiDraft> {
  const opp = await getOpportunity(opportunityId);
  if (!opp) throw new SalesAiError("Opportunity not found.");
  const stages = await stagesFor(opportunityId);
  const current = stages.find((s) => s.id === opp.stage_id) ?? null;
  if (!current || !isAgentStage(current) || opp.status !== "open") {
    throw new SalesAiError("The AI agent is off in this stage. It works New opportunity, Qualified, Meeting, Proposal and Negotiation.");
  }

  const [assignment, agentRows] = await Promise.all([getAssignment(opportunityId), listAgentRows()]);
  const agent = assignment?.agentId ? agentRows.find((a) => a.id === assignment.agentId) ?? null : null;
  const chatUrl = agent && assignment ? chatUrlFor(agent, assignment.chatTag) : null;
  const chats = agent && assignment ? await loadChats(agent.id, assignment.chatTag) : [];

  const { activity } = await loadTimeline({ opportunityId, contactCrmId: opp.contact_crm_id });
  const thread = threadText(activity, chats);
  const { quotes, aiRead } = await extractQuotes(thread);
  const audit = buildAudit({ opportunity: opp, stageName: current.name, items: activity, chats, quotes, aiRead });

  const parts = buildParts({
    firstName: opp.contact_name?.trim().split(/\s+/)[0] || null,
    asked: audit.asked, concern: audit.concern, objection: audit.objection, chatUrl, includeRefundOffer,
  });
  const violations = draftViolations(writtenText(parts));
  if (violations.length) throw new SalesAiError(`The draft broke a copy rule (${violations.join(", ")}). Nothing was saved.`);

  const lastSent = [...activity].sort((a, b) => b.created_at.localeCompare(a.created_at)).find((i) => /^Email sent: /.test(i.summary));
  const lastSubject = lastSent ? lastSent.summary.replace(/^Email sent: /, "") : null;

  return insertDraft({
    opportunityId, agentId: agent?.id ?? null, stageId: current.id, objection: audit.objection, technique: audit.technique, audit,
    subject: subjectFor(opp.title, lastSubject), body: renderBody(parts), bodyParts: parts, includeRefundOffer, chatUrl, userId,
  });
}

export type DraftEdit = { subject?: string; body?: string; includeRefundOffer?: boolean; status?: "sent" | "discarded" };

export async function editDraft(draftId: string, edit: DraftEdit, userId: string): Promise<SalesAiDraft> {
  const draft = await getDraft(draftId);
  if (!draft) throw new SalesAiError("Draft not found.");
  if (draft.status !== "draft") throw new SalesAiError("This draft is closed.");

  let bodyParts: DraftParts | null | undefined;
  let body: string | undefined;
  if (edit.body !== undefined) {
    // A typed edit becomes the body as written. The refund switch then no longer rebuilds it.
    body = edit.body;
    bodyParts = null;
  } else if (edit.includeRefundOffer !== undefined && draft.bodyParts) {
    bodyParts = withRefund(draft.bodyParts, edit.includeRefundOffer);
    body = renderBody(bodyParts);
  } else if (edit.includeRefundOffer !== undefined) {
    throw new SalesAiError("This draft was edited by hand, so the refund line cannot be switched. Edit the text, or make a new draft.");
  }
  return patchDraft(draftId, { subject: edit.subject, body, bodyParts, includeRefundOffer: edit.includeRefundOffer, status: edit.status, sentBy: userId });
}

/** Looks at the agent chats for this opportunity and files stage moves for a person to confirm. */
export async function refreshSuggestions(opportunityId: string): Promise<void> {
  const opp = await getOpportunity(opportunityId);
  if (!opp || opp.status !== "open") return;
  const assignment = await getAssignment(opportunityId);
  if (!assignment?.agentId) return;
  const [stages, chats] = await Promise.all([stagesFor(opportunityId), loadChats(assignment.agentId, assignment.chatTag)]);
  if (!chats.length) return;
  const moves = suggestMoves(stages, opp.stage_id, { booked: chats.some((c) => c.booked), stopped: chats.some((c) => c.stopped) });
  for (const m of moves) {
    const conv = chats.find((c) => (m.source === "chat_booked" ? c.booked : c.stopped));
    await addSuggestionOnce({ opportunityId, fromStageId: opp.stage_id, toStageId: m.toStageId, reason: m.reason, source: m.source, conversationId: conv?.id ?? null });
  }
}

export async function resolveSuggestion(suggestionId: string, action: "apply" | "dismiss", userId: string): Promise<void> {
  const s = await getSuggestion(suggestionId);
  if (!s) throw new SalesAiError("Suggestion not found.");
  if (s.status !== "pending") throw new SalesAiError("That suggestion was already decided.");
  if (action === "dismiss") {
    await decideSuggestion(suggestionId, "dismissed", userId);
    return;
  }
  const stages = await stagesFor(s.opportunity_id);
  const target = stages.find((st) => st.id === s.to_stage_id);
  if (!target) throw new SalesAiError("That stage no longer exists.");
  await updateOpportunity(s.opportunity_id, stagePatchFor(target), userId);
  await decideSuggestion(suggestionId, "applied", userId);
}
