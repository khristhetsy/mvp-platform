import { isMoneyBand } from "@/lib/profile/options";

// The onboarding coach can pre-select an answer in the wizard. The founder still checks it and
// presses Next, so nothing is saved by the coach.
export const COACH_PICK_EVENT = "icapos:onboarding-coach-pick";

export type CoachPick = { field: "amount"; value: string };

/** The funding band to select, or null when the event carries anything else. */
export function parseCoachPick(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Partial<CoachPick>;
  return d.field === "amount" && typeof d.value === "string" && isMoneyBand(d.value) ? d.value : null;
}

export function dispatchCoachPick(pick: CoachPick) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CoachPick>(COACH_PICK_EVENT, { detail: pick }));
}
