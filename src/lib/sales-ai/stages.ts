/**
 * Which stages the sales AI agent works, and which stage moves it may suggest.
 *
 * Off in Pending, Won and Loss: in those there is no sale for the agent to make.
 * Moves are only ever suggestions a person applies. They are derived from facts
 * the chat recorded (a booked time, a stopped conversation), never from the
 * agent's reading of a message, and never go backward or to Won.
 */

export type StageLite = { id: string; name: string; sort_order: number; is_won: boolean };

export const isLossName = (name: string): boolean => /^los[st]$/i.test(name.trim());
export const isPendingName = (name: string): boolean => /^pending$/i.test(name.trim());
export const isMeetingName = (name: string): boolean => /^meeting$/i.test(name.trim());

export function isAgentStage(stage: Pick<StageLite, "name" | "is_won">): boolean {
  return !stage.is_won && !isLossName(stage.name) && !isPendingName(stage.name);
}

/** The patch to apply for a stage, matching the stage bar on the opportunity page. */
export function stagePatchFor(stage: Pick<StageLite, "id" | "name" | "is_won">): { stageId: string; status?: "lost" } {
  if (isLossName(stage.name)) return { stageId: stage.id, status: "lost" };
  return { stageId: stage.id };
}

export type ChatFacts = { booked: boolean; stopped: boolean };
export type MoveSuggestion = { toStageId: string; reason: string; source: "chat_booked" | "chat_stopped" };

export function suggestMoves(stages: StageLite[], currentStageId: string | null, facts: ChatFacts): MoveSuggestion[] {
  const current = stages.find((s) => s.id === currentStageId) ?? null;
  if (!current || !isAgentStage(current)) return [];
  const out: MoveSuggestion[] = [];

  if (facts.booked) {
    const meeting = stages.find((s) => isMeetingName(s.name));
    if (meeting && meeting.sort_order > current.sort_order) {
      out.push({ toStageId: meeting.id, source: "chat_booked", reason: "The prospect booked a time from the chat." });
    }
  }
  if (facts.stopped) {
    const loss = stages.find((s) => isLossName(s.name));
    if (loss) out.push({ toStageId: loss.id, source: "chat_stopped", reason: "The prospect stopped the conversation. Confirm only if this is a no." });
  }
  return out;
}
