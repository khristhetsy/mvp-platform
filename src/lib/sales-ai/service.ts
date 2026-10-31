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
import { createNote } from "@/lib/sales/chatter";
import { getOpportunity, updateOpportunity } from "@/lib/sales/opportunities";
import { loadTimeline } from "@/lib/sales/chatter";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildAudit, extractQuotes, threadText } from "./audit";
import { buildMeetingBrief, suggestTasks } from "./brief";
import { buildFollowUpParts, buildParts, renderBody, subjectFor, withRefund, writtenText } from "./draft";
import { draftViolations } from "./guards";
import { isAgentStage, stagePatchFor, suggestAfterMeeting, suggestMoves, type StageLite } from "./stages";
import {
  addSuggestionOnce, chatUrlFor, decideSuggestion, getAssignment, getDraft, getSuggestion, insertDraft, latestOpenDraft,
  listAgentRows, listPendingSuggestions, loadChats, patchDraft, saveAssignment, toAgentOption,
} from "./store";
import type { DraftParts, MeetingBrief, SalesAiDraft, SalesAiState, SuggestedTask } from "./types";

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

/** Reads the opportunity and everything said on it, and writes the audit. Used by the draft and the meeting cycle. */
async function readForAgent(opportunityId: string, meetingNotes?: string) {
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
  const audit = buildAudit({ opportunity: opp, stageName: current.name, items: activity, chats, quotes, aiRead, meetingNotes });

  const lastSent = [...activity].sort((a, b) => b.created_at.localeCompare(a.created_at)).find((i) => /^Email sent: /.test(i.summary));
  const lastSubject = lastSent ? lastSent.summary.replace(/^Email sent: /, "") : null;
  const firstName = opp.contact_name?.trim().split(/\s+/)[0] || null;
  return { opp, stages, current, agent, chatUrl, audit, lastSubject, firstName };
}

function assertClean(parts: DraftParts): void {
  const violations = draftViolations(writtenText(parts));
  if (violations.length) throw new SalesAiError(`The draft broke a copy rule (${violations.join(", ")}). Nothing was saved.`);
}

export async function createAuditDraft(opportunityId: string, userId: string, includeRefundOffer: boolean): Promise<SalesAiDraft> {
  const r = await readForAgent(opportunityId);
  const parts = buildParts({ firstName: r.firstName, asked: r.audit.asked, concern: r.audit.concern, objection: r.audit.objection, chatUrl: r.chatUrl, includeRefundOffer });
  assertClean(parts);
  return insertDraft({
    opportunityId, agentId: r.agent?.id ?? null, stageId: r.current.id, objection: r.audit.objection, technique: r.audit.technique, audit: r.audit,
    subject: subjectFor(r.opp.title, r.lastSubject), body: renderBody(parts), bodyParts: parts, includeRefundOffer, chatUrl: r.chatUrl, userId,
  });
}

/** The brief before a meeting, from the same reading the email uses. Read only. */
export async function getMeetingBrief(opportunityId: string): Promise<MeetingBrief> {
  const r = await readForAgent(opportunityId);
  return buildMeetingBrief({ title: r.opp.title, contactName: r.opp.contact_name, stageName: r.current.name, audit: r.audit });
}

export const MEETING_NOTES_MIN = 10;
export const MEETING_NOTES_MAX = 2000;

/**
 * After a meeting. The person's own notes become: an optional Notes log entry (their text,
 * saved only when they ticked the box), a follow up draft, suggested tasks, and a suggested
 * stage move. The draft and the move still wait for a click.
 */
export async function createFollowUpDraft(
  opportunityId: string, userId: string, input: { notes: string; saveNote: boolean; includeRefundOffer: boolean },
): Promise<{ draft: SalesAiDraft; tasks: SuggestedTask[] }> {
  const notes = input.notes.trim();
  if (notes.length < MEETING_NOTES_MIN) throw new SalesAiError("Write a line or two about the meeting first.");
  if (notes.length > MEETING_NOTES_MAX) throw new SalesAiError("Keep the meeting notes under 2,000 characters.");

  const r = await readForAgent(opportunityId, notes);
  const parts = buildFollowUpParts({ firstName: r.firstName, objection: r.audit.objection, chatUrl: r.chatUrl, includeRefundOffer: input.includeRefundOffer });
  assertClean(parts);

  if (input.saveNote) await createNote(`Meeting notes: ${notes}`, { opportunityId }, userId, false);

  const draft = await insertDraft({
    opportunityId, agentId: r.agent?.id ?? null, stageId: r.current.id, objection: r.audit.objection, technique: r.audit.technique, audit: r.audit,
    subject: subjectFor(r.opp.title, null), body: renderBody(parts), bodyParts: parts, includeRefundOffer: input.includeRefundOffer, chatUrl: r.chatUrl, userId,
  });
  for (const m of suggestAfterMeeting(r.stages, r.opp.stage_id)) {
    await addSuggestionOnce({ opportunityId, fromStageId: r.opp.stage_id, toStageId: m.toStageId, reason: m.reason, source: m.source });
  }
  return { draft, tasks: suggestTasks({ contactName: r.opp.contact_name, objection: r.audit.objection }) };
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
