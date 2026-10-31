/**
 * The daily queue: which opportunities need a person today, and why.
 *
 * Rules, not a model, so the same facts always give the same order and every
 * row can say what put it there. Pure: the data gathering lives in queue-store.ts.
 *
 * Reasons and weights, highest first:
 *   suggestion  a stage move from the agent's chat is waiting for a person   +50
 *   chat_new    the prospect chatted after the last email, or chatted and was  +40
 *               never emailed
 *   draft       a draft email is ready to review                               +15
 *   fresh       new, and the agent has not emailed them yet                    +20
 *   stale       no logged activity for STALE_DAYS or more                      +min(30, days)
 * Ties go to the one that has waited longest.
 */

export const STALE_DAYS = 7;
export const STORED_LIMIT = 25;

export type QueueReason = { code: "suggestion" | "chat_new" | "draft" | "fresh" | "stale"; text: string; source: string };

export type QueueCandidate = {
  id: string;
  stageName: string;
  createdAt: string;
  /** Newest logged activity of any kind, or null when none is logged. */
  lastActivityAt: string | null;
  pendingSuggestions: number;
  chatCount: number;
  /** Newest conversation update, or null. */
  lastChatAt: string | null;
  /** When the newest email from the agent was sent, or null. */
  lastEmailSentAt: string | null;
  openDraft: boolean;
  /** Still snoozed from an earlier day. */
  snoozed: boolean;
};

export type QueueEntry = { opportunityId: string; rank: number; score: number; reasons: QueueReason[]; stageName: string };

const DAY_MS = 86_400_000;
export const daysBetween = (fromIso: string, now: Date): number => Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY_MS));

export function scoreCandidate(c: QueueCandidate, now: Date): { score: number; reasons: QueueReason[]; waitedDays: number } {
  const reasons: QueueReason[] = [];
  let score = 0;

  if (c.pendingSuggestions > 0) {
    score += 50;
    reasons.push({ code: "suggestion", text: "A stage move from the agent's chat is waiting for you.", source: "Agent chat" });
  }

  if (c.chatCount > 0 && c.lastChatAt && (!c.lastEmailSentAt || c.lastChatAt > c.lastEmailSentAt)) {
    score += 40;
    reasons.push({
      code: "chat_new",
      text: c.lastEmailSentAt ? "The prospect chatted with the agent after your last email." : "The prospect chatted with the agent.",
      source: "Agent chat",
    });
  }

  if (c.openDraft) {
    score += 15;
    reasons.push({ code: "draft", text: "A draft email is ready to review.", source: "AI agent tab" });
  }

  const ageDays = daysBetween(c.createdAt, now);
  if (!c.lastEmailSentAt && !c.lastActivityAt && ageDays <= STALE_DAYS && /^new opportunity$/i.test(c.stageName.trim())) {
    score += 20;
    reasons.push({ code: "fresh", text: "New, and no email has gone out yet.", source: "Opportunity record" });
  }

  const idleDays = c.lastActivityAt ? daysBetween(c.lastActivityAt, now) : ageDays;
  if (idleDays >= STALE_DAYS) {
    score += Math.min(30, idleDays);
    reasons.push({
      code: "stale",
      text: c.lastActivityAt ? `No logged activity for ${idleDays} days in ${c.stageName}.` : `No logged activity since it was created ${idleDays} days ago.`,
      source: c.lastActivityAt ? "Notes log" : "Opportunity record",
    });
  }

  return { score, reasons, waitedDays: idleDays };
}

/** Highest score first, then the one that has waited longest. Snoozed and reason-less rows are left out. */
export function rankQueue(candidates: QueueCandidate[], now: Date, limit = STORED_LIMIT): QueueEntry[] {
  return candidates
    .filter((c) => !c.snoozed)
    .map((c) => ({ c, ...scoreCandidate(c, now) }))
    .filter((x) => x.reasons.length > 0)
    .sort((a, b) => b.score - a.score || b.waitedDays - a.waitedDays || a.c.id.localeCompare(b.c.id))
    .slice(0, limit)
    .map((x, i) => ({ opportunityId: x.c.id, rank: i + 1, score: x.score, reasons: x.reasons, stageName: x.c.stageName }));
}

/** Today as YYYY-MM-DD in UTC, the key the queue is stored under. */
export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
}
