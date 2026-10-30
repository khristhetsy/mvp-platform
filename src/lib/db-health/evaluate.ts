/**
 * Database health rules, with no database access so they can be tested.
 *
 * The check (run.ts) takes a reading every 5 minutes and asks this file three
 * things: how bad is this reading, should an incident open or close, and what
 * was the likely cause.
 *
 * The defaults are anchored to cutoffs the database really has: signed in
 * requests are cancelled at 8 s and scheduled jobs stop at 60 s. The warning
 * and overload limits sit below the first, the query limit below the second.
 */

export type HealthState = "ok" | "warn" | "overload";
export type IncidentCause = "jobs_and_queries" | "job_timeout" | "slow_query" | "slow_response";

export type HealthSettings = {
  /** Warn when the test query takes longer than this. */
  warnMs: number;
  /** Overload when the test query takes longer than this. */
  overloadMs: number;
  /** Checks in a row needed to open or close an overload incident. */
  consecutive: number;
  /** Alert when any query has been running longer than this, in seconds. */
  queryLimitS: number;
  alertOnCronTimeouts: boolean;
  notifyBell: boolean;
  notifyEmail: boolean;
};

export const DEFAULT_HEALTH_SETTINGS: HealthSettings = {
  warnMs: 2_000,
  overloadMs: 5_000,
  consecutive: 2,
  queryLimitS: 30,
  alertOnCronTimeouts: true,
  notifyBell: true,
  notifyEmail: true,
};

/** Cutoffs the limits must stay below. */
export const SIGNED_IN_REQUEST_CUTOFF_MS = 8_000;
export const JOB_CUTOFF_S = 60;

export type Reading = {
  /** Null when the test query failed. */
  responseMs: number | null;
  probeFailed: boolean;
  longestQueryS: number | null;
  /** Jobs newly found to have started and never finished since the previous check. */
  newCronTimeouts: number;
};

/** Merge saved settings over the defaults, dropping anything invalid or out of range. */
export function normalizeSettings(raw: unknown): HealthSettings {
  const d = DEFAULT_HEALTH_SETTINGS;
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

  let warnMs = num(o.warnMs, 100, SIGNED_IN_REQUEST_CUTOFF_MS - 100, d.warnMs);
  let overloadMs = num(o.overloadMs, 200, SIGNED_IN_REQUEST_CUTOFF_MS - 1, d.overloadMs);
  // The warning limit must stay below the overload limit.
  if (warnMs >= overloadMs) {
    warnMs = d.warnMs;
    overloadMs = d.overloadMs;
  }
  return {
    warnMs,
    overloadMs,
    consecutive: Math.round(num(o.consecutive, 1, 6, d.consecutive)),
    queryLimitS: num(o.queryLimitS, 5, JOB_CUTOFF_S - 1, d.queryLimitS),
    alertOnCronTimeouts: bool(o.alertOnCronTimeouts, d.alertOnCronTimeouts),
    notifyBell: bool(o.notifyBell, d.notifyBell),
    notifyEmail: bool(o.notifyEmail, d.notifyEmail),
  };
}

/** How bad one reading is. A failed test query counts as overload. */
export function classifyState(r: Reading, s: HealthSettings): HealthState {
  if (r.probeFailed || r.responseMs === null) return "overload";
  if (r.responseMs >= s.overloadMs) return "overload";
  if (r.responseMs >= s.warnMs) return "warn";
  if (r.longestQueryS !== null && r.longestQueryS >= s.queryLimitS) return "warn";
  if (r.newCronTimeouts > 0 && s.alertOnCronTimeouts) return "warn";
  return "ok";
}

export function classifyCause(r: Reading, s: HealthSettings): IncidentCause {
  const longQuery = r.longestQueryS !== null && r.longestQueryS >= s.queryLimitS;
  const timeouts = r.newCronTimeouts > 0;
  if (timeouts && longQuery) return "jobs_and_queries";
  if (timeouts) return "job_timeout";
  if (longQuery) return "slow_query";
  return "slow_response";
}

export const CAUSE_LABEL: Record<IncidentCause, string> = {
  jobs_and_queries: "Jobs and queries running at once",
  job_timeout: "A scheduled job timed out",
  slow_query: "One slow query",
  slow_response: "Slow response, cause unclear",
};

export type OpenIncident = {
  id: number;
  peakState: "warn" | "overload";
  peakResponseMs: number | null;
  peakQueryS: number | null;
  cronTimeouts: number;
};

export type Decision =
  | { action: "none" }
  | { action: "open"; cause: IncidentCause; peakState: "warn" | "overload" }
  | { action: "update"; peakState: "warn" | "overload"; peakResponseMs: number | null; peakQueryS: number | null; cronTimeouts: number }
  | { action: "close" };

/**
 * `recentStates` is newest first and already includes the current reading.
 *
 * Opens on: the last N readings all overload, any query over the limit, or a
 * newly timed out job (when that alert is on). Closes once the last N readings
 * are all ok.
 */
export function decide(input: {
  reading: Reading;
  state: HealthState;
  recentStates: HealthState[];
  open: OpenIncident | null;
  settings: HealthSettings;
}): Decision {
  const { reading, state, recentStates, open, settings } = input;
  const lastN = recentStates.slice(0, settings.consecutive);
  const haveN = lastN.length >= settings.consecutive;

  if (open) {
    if (haveN && lastN.every((x) => x === "ok")) return { action: "close" };
    const peakState = open.peakState === "overload" || state === "overload" ? "overload" : "warn";
    const peakResponseMs = Math.max(open.peakResponseMs ?? 0, reading.responseMs ?? 0) || null;
    const peakQueryS = Math.max(open.peakQueryS ?? 0, reading.longestQueryS ?? 0) || null;
    return { action: "update", peakState, peakResponseMs, peakQueryS, cronTimeouts: open.cronTimeouts + reading.newCronTimeouts };
  }

  const overloadRun = haveN && lastN.every((x) => x === "overload");
  const longQuery = reading.longestQueryS !== null && reading.longestQueryS >= settings.queryLimitS;
  const jobTimeout = reading.newCronTimeouts > 0 && settings.alertOnCronTimeouts;
  if (!overloadRun && !longQuery && !jobTimeout) return { action: "none" };

  return { action: "open", cause: classifyCause(reading, settings), peakState: state === "overload" ? "overload" : "warn" };
}

export function alertText(input: {
  cause: IncidentCause;
  peakState: "warn" | "overload";
  reading: Reading;
  /** Names of the jobs that timed out, when known. */
  timedOutJobs?: string[];
  /** Where the alert should send the reader. */
  pointer?: string;
}): { title: string; message: string } {
  const { cause, peakState, reading } = input;
  const parts: string[] = [];
  if (reading.probeFailed || reading.responseMs === null) parts.push("the test query failed");
  else parts.push(`the test query took ${(reading.responseMs / 1000).toFixed(1)} s`);
  if (reading.longestQueryS !== null) parts.push(`the longest query has run ${Math.round(reading.longestQueryS)} s`);
  if (reading.newCronTimeouts > 0) {
    const names = input.timedOutJobs?.length ? ` (${input.timedOutJobs.join(", ")})` : "";
    parts.push(`${reading.newCronTimeouts} scheduled job${reading.newCronTimeouts === 1 ? "" : "s"} timed out${names}`);
  }
  const lead = peakState === "overload" ? "Database overloaded" : "Database slow";
  return {
    title: `${lead}: ${CAUSE_LABEL[cause].toLowerCase()}`,
    message: `${parts.join(", ")}. ${input.pointer ?? "Open System health to see what to do."}`.replace(/^./, (c) => c.toUpperCase()),
  };
}
