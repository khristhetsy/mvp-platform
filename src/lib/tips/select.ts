import type { JourneyStage } from "@/lib/founder-journey/types";
import { TIPS, type InvestorTipState, type Tip, type TipAudience } from "./library";

export type TipSelectionInput = {
  audience: TipAudience;
  founderStage?: JourneyStage;
  investorState?: InvestorTipState;
  /** Stable per-day seed (e.g. "2026-06-20") — same day yields the same tip. */
  dateKey: string;
};

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function matchesContext(tip: Tip, input: TipSelectionInput): boolean {
  if (tip.audience !== input.audience) return false;
  if (input.audience === "founder") {
    // General tips (no stage) are always eligible; staged tips must match.
    return tip.founderStage === undefined || tip.founderStage === input.founderStage;
  }
  return tip.investorState === undefined || tip.investorState === input.investorState;
}

/** Pick the tip of the day for a user's context — deterministic per day. */
export function selectTip(input: TipSelectionInput): Tip | null {
  const pool = TIPS.filter((tip) => matchesContext(tip, input));
  if (pool.length === 0) return null;
  const index = hashString(`${input.audience}:${input.dateKey}`) % pool.length;
  return pool[index];
}

/** YYYY-MM-DD key for a given date (defaults to now). */
export function tipDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
