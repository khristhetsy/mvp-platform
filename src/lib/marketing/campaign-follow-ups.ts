/**
 * Follow up emails for the New campaign wizard. Each one becomes a step of a marketing
 * sequence, so the existing sequence engine (delays, conditions, approval batches) sends them.
 * Pure helpers only: validation and mapping, no database.
 */
import type { MarketingSequenceStep } from "./types";

export type FollowUpCondition = MarketingSequenceStep["condition"];

export type FollowUpInput = {
  template_id: string;
  /** Days to wait after the previous email (the campaign for the first follow up). */
  delay_days: number;
  condition: FollowUpCondition;
};

export const FOLLOW_UP_CONDITIONS: ReadonlyArray<{ value: FollowUpCondition; label: string }> = [
  { value: "no_reply", label: "If no reply" },
  { value: "no_open", label: "If not opened" },
  { value: "no_click", label: "If not clicked" },
  { value: "always", label: "Always" },
];

export const MAX_FOLLOW_UPS = 5;
export const MAX_FOLLOW_UP_DELAY_DAYS = 90;

const CONDITIONS = new Set<string>(FOLLOW_UP_CONDITIONS.map((c) => c.value));

/** Keeps the valid follow ups from an untrusted request body. Anything else is dropped. */
export function cleanFollowUps(raw: unknown): FollowUpInput[] {
  if (!Array.isArray(raw)) return [];
  const out: FollowUpInput[] = [];
  for (const item of raw) {
    if (out.length >= MAX_FOLLOW_UPS) break;
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const templateId = typeof r.template_id === "string" ? r.template_id.trim() : "";
    if (!templateId) continue;
    const days = Math.round(Number(r.delay_days));
    if (!Number.isFinite(days) || days < 0) continue;
    const condition = typeof r.condition === "string" && CONDITIONS.has(r.condition) ? (r.condition as FollowUpCondition) : "no_reply";
    out.push({ template_id: templateId, delay_days: Math.min(days, MAX_FOLLOW_UP_DELAY_DAYS), condition });
  }
  return out;
}

/** Sequence step rows for the follow ups, numbered from 1 in the order given. */
export function followUpSteps(
  followUps: FollowUpInput[],
  sequenceId: string,
  sender: { from_name: string; from_email: string },
): Array<Omit<MarketingSequenceStep, "id" | "created_at" | "template">> {
  return followUps.map((f, i) => ({
    sequence_id: sequenceId,
    step_order: i + 1,
    template_id: f.template_id,
    delay_days: f.delay_days,
    condition: f.condition,
    from_name: sender.from_name,
    from_email: sender.from_email,
  }));
}
