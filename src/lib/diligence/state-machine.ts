// Lifecycle state machine (§8) — pure transition rules. The DB-applying wrapper
// lives in the server actions (later phases); this module is the single source
// of truth for what's legal, and is unit-tested.

import type { Stage, DiligenceRole } from "./types";

export type TransitionAction =
  | "send_to_founder"
  | "founder_responded"
  | "mark_review"
  | "request_consent"
  | "consent_completed"
  | "release";

export const TRANSITIONS: Record<TransitionAction, { from: Stage; to: Stage; role: DiligenceRole }> = {
  send_to_founder: { from: "draft", to: "sent_to_founder", role: "admin" },
  founder_responded: { from: "sent_to_founder", to: "responding", role: "founder" },
  mark_review: { from: "responding", to: "admin_review", role: "admin" },
  request_consent: { from: "admin_review", to: "consent_requested", role: "admin" },
  consent_completed: { from: "consent_requested", to: "consented_locked", role: "admin" },
  release: { from: "consented_locked", to: "released", role: "admin" },
};

// Order used by `recall` to step one stage back (and reopen).
export const STAGE_ORDER: Stage[] = [
  "draft",
  "sent_to_founder",
  "responding",
  "admin_review",
  "consent_requested",
  "consented_locked",
  "released",
];

export type TransitionResult =
  | { ok: true; to: Stage }
  | { ok: false; error: string };

/** Validate a transition from `current` for `action` by `role`. Pure. */
export function evaluateTransition(current: Stage, action: TransitionAction, role: DiligenceRole): TransitionResult {
  const t = TRANSITIONS[action];
  if (!t) return { ok: false, error: "Unknown action." };
  if (current !== t.from) return { ok: false, error: `Illegal transition: ${current} → ${t.to}.` };
  if (role !== t.role) return { ok: false, error: `Only ${t.role} can perform ${action}.` };
  return { ok: true, to: t.to };
}

/** One stage back from `current` (for admin recall). Null at draft. */
export function priorStage(current: Stage): Stage | null {
  const i = STAGE_ORDER.indexOf(current);
  return i > 0 ? STAGE_ORDER[i - 1]! : null;
}
