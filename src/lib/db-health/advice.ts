/**
 * What to suggest when the database is slow, with no database access so it can be tested.
 *
 * The AI card never decides what to do. These rules choose the suggestions from the
 * readings, and the model only explains them in words, using the facts built here.
 * Nothing runs from the card: each suggestion points at a button under Fix it,
 * where a person confirms it.
 */
import { labelQuery, queryVerdict } from "@/lib/db-health/baseline";
import { fmtMs } from "@/lib/db-health/tiles";
import type { HealthSettings, HealthState } from "@/lib/db-health/evaluate";
import type { IncidentRow, JobTimeouts, LongQuery, QueryStats, SampleRow } from "@/lib/db-health/load";

export type Suggestion = {
  kind: "cancel_query" | "pause_job" | "capacity";
  /** One line, in plain words. */
  text: string;
  /** Where the person acts on it. */
  target: "fix-it" | "capacity";
};

export function suggestActions(input: {
  state: HealthState | null;
  longQueries: LongQuery[] | null;
  jobs: JobTimeouts[];
  pausedPaths: string[];
  settings: HealthSettings;
}): Suggestion[] {
  const { state, longQueries, jobs, pausedPaths, settings } = input;
  if (state === null || state === "ok") return [];
  const out: Suggestion[] = [];

  for (const q of (longQueries ?? []).filter((x) => x.seconds >= settings.queryLimitS).slice(0, 2)) {
    out.push({ kind: "cancel_query", text: `Cancel the query that has run ${Math.round(q.seconds)} s, over your ${settings.queryLimitS} s limit.`, target: "fix-it" });
  }
  for (const j of jobs.filter((x) => x.timeouts > 0 && !pausedPaths.includes(x.path)).slice(0, 2)) {
    out.push({ kind: "pause_job", text: `Pause ${j.name}. It timed out ${j.timeouts} time${j.timeouts === 1 ? "" : "s"} in the last 24 hours.`, target: "fix-it" });
  }
  if (state === "overload") {
    out.push({ kind: "capacity", text: "Check the Supabase Database report for CPU, memory or disk at the limit. If it is, add capacity.", target: "capacity" });
  }
  return out;
}

/** The figures the model may use. Query text is never included, only its label. */
export function adviceFacts(input: {
  now: number;
  state: HealthState | null;
  settings: HealthSettings;
  latest: SampleRow | null;
  open: IncidentRow | null;
  jobs: JobTimeouts[];
  queryStats: QueryStats | null;
  baselineLine: string;
}): string {
  const { state, settings, latest, open, jobs, queryStats, baselineLine } = input;
  if (!latest || state === null) return "Nothing is measured yet. No health check has run.";
  const lines = [
    `State: ${state === "overload" ? "overloaded" : state === "warn" ? "slow" : "healthy"}.`,
    `Test query: ${latest.response_ms === null ? "failed" : fmtMs(latest.response_ms)}. Warning limit ${fmtMs(settings.warnMs)}, overload limit ${fmtMs(settings.overloadMs)}. Signed in requests are cancelled by the database at 8 s.`,
    `Longest running query: ${latest.longest_query_s === null ? "none running" : `${latest.longest_query_s} s`}. Query limit ${settings.queryLimitS} s. Scheduled jobs stop at 60 s.`,
    `Open connections: ${latest.active_connections ?? "not read"}.`,
    `Normal: ${baselineLine}.`,
  ];
  const timedOut = jobs.filter((j) => j.timeouts > 0);
  lines.push(timedOut.length ? `Jobs that timed out in 24 hours: ${timedOut.map((j) => `${j.name} (${j.timeouts} of ${j.runs} runs)`).join(", ")}.` : "No job timed out in 24 hours.");
  if (open) lines.push(`An incident is open: ${open.cause.replace(/_/g, " ")}.`);
  const p90 = queryStats?.norms.p90_mean_ms ?? null;
  const slow = (queryStats?.top ?? []).map((q) => ({ q, v: queryVerdict(q.mean_ms, p90) })).filter((x) => x.v.verdict === "above").slice(0, 3);
  if (slow.length) lines.push(`Queries above normal: ${slow.map((x) => `${labelQuery(x.q.q)} (${fmtMs(x.q.mean_ms)} average, ${x.v.timesOver}x the normal limit of ${p90} ms)`).join("; ")}.`);
  return lines.join("\n");
}
