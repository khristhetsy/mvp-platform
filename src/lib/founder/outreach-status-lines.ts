// Client-safe half of outreach-status: the shape and the status line copy.
// The loader lives in outreach-status.ts (server only).

/** Remembers the last Outreach mode; the deploy page reads it for the first render. */
export const OUTREACH_MODE_COOKIE = "icapos_outreach_mode";

export type AutomatedOutreachState = "running" | "paused" | "not_started";

export type OutreachStatus = {
  automated: { state: AutomatedOutreachState; sent: number; launched: boolean };
  manual: { sent: number; started: boolean };
  /** Both modes used — the Outreach step is done. */
  complete: boolean;
};

export const EMPTY_OUTREACH_STATUS: OutreachStatus = {
  automated: { state: "not_started", sent: 0, launched: false },
  manual: { sent: 0, started: false },
  complete: false,
};

/** The one-line status under each mode in the Outreach dropdown. */
export function automatedStatusLine(s: OutreachStatus, opts?: { requiredNote?: boolean }): string {
  if (s.automated.state === "running") return `Running, ${s.automated.sent} sent`;
  if (s.automated.state === "paused") return `Paused, ${s.automated.sent} sent`;
  return opts?.requiredNote ? "Not started, needed to complete Stage 3" : "Not started";
}

export function manualStatusLine(s: OutreachStatus, opts?: { requiredNote?: boolean }): string {
  if (s.manual.started) return `${s.manual.sent} sent`;
  return opts?.requiredNote ? "Not started, needed to complete Stage 3" : "Not started";
}
