import { JOURNEY_STAGES, type JourneyStage } from "@/lib/founder-journey/types";
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

function stageRank(stage: JourneyStage | undefined): number {
  return stage ? JOURNEY_STAGES.indexOf(stage) : 0;
}

function matchesContext(tip: Tip, input: TipSelectionInput): boolean {
  if (tip.audience !== input.audience) return false;
  if (input.audience === "founder") {
    // Stage tips must match the founder's stage exactly.
    if (tip.founderStage !== undefined) return tip.founderStage === input.founderStage;
    // Menu tips appear once the founder has reached the stage that unlocks the page.
    if (tip.minStage !== undefined) return stageRank(input.founderStage) >= stageRank(tip.minStage);
    return true;
  }
  return tip.investorState === undefined || tip.investorState === input.investorState;
}

/** Whole days since 1970-01-01 for a YYYY-MM-DD key (falls back to a hash if unparsable). */
function dayNumber(dateKey: string): number {
  const ms = Date.parse(`${dateKey}T00:00:00Z`);
  return Number.isNaN(ms) ? hashString(dateKey) : Math.floor(ms / 86_400_000);
}

/**
 * Pick the tip of the day for a user's context. Deterministic per day, and it
 * steps through the eligible pool one tip per day, so every tip is shown once
 * per cycle (a plain hash would repeat some tips and skip others).
 */
export function selectTip(input: TipSelectionInput): Tip | null {
  const pool = TIPS.filter((tip) => matchesContext(tip, input));
  if (pool.length === 0) return null;
  const index = (dayNumber(input.dateKey) + hashString(input.audience)) % pool.length;
  return pool[index];
}

/** YYYY-MM-DD key for a given date (defaults to now). */
export function tipDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
