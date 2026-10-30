/**
 * Patterns across incidents and queries, with no database access so it can be tested.
 * Every figure is counted from the log. A pattern needs at least 3 incidents to be
 * shown, so two bad nights never read as a trend.
 */
import { labelQuery, queryVerdict } from "@/lib/db-health/baseline";
import { CAUSE_LABEL, type IncidentCause } from "@/lib/db-health/evaluate";
import type { IncidentRow, QueryStats } from "@/lib/db-health/load";
import { fmtMs } from "@/lib/db-health/tiles";

export const MIN_INCIDENTS = 3;

export type Pattern = { key: string; title: string; detail: string; suggestion: string };
export type PatternsResult = { patterns: Pattern[]; incidents: number; needed: number };

/** The values a cron field fires on: `*`, `*` with a step, `a-b`, `a-b/n`, `n` and comma lists. */
export function expandField(field: string, min: number, max: number): number[] {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isInteger(step) || step < 1) continue;
    let lo = min, hi = max;
    if (range && range !== "*") {
      const [a, b] = range.split("-");
      lo = Number(a);
      hi = b === undefined ? (stepRaw ? max : lo) : Number(b);
    }
    if (!Number.isInteger(lo) || !Number.isInteger(hi)) continue;
    for (let v = Math.max(lo, min); v <= Math.min(hi, max); v += step) out.add(v);
  }
  return [...out].sort((a, b) => a - b);
}

/** Jobs that fire in a given UTC hour, leaving out the ones that run so often they always match. */
export function jobsInHour(jobs: { name: string; schedules: string[] }[], hourUtc: number, maxRunsPerHour = 4): string[] {
  const names: string[] = [];
  for (const j of jobs) {
    let runs = 0;
    for (const expr of j.schedules) {
      const [m, h] = expr.trim().split(/\s+/);
      if (m === undefined || h === undefined) continue;
      if (expandField(h, 0, 23).includes(hourUtc)) runs += expandField(m, 0, 59).length;
    }
    if (runs > 0 && runs <= maxRunsPerHour) names.push(j.name);
  }
  return names;
}

const pct = (n: number, d: number) => Math.round((n / d) * 100);

export function findPatterns(input: {
  incidents: IncidentRow[];
  jobs: { name: string; schedules: string[] }[];
  queryStats: QueryStats | null;
}): PatternsResult {
  const { incidents, jobs, queryStats } = input;
  const patterns: Pattern[] = [];
  const n = incidents.length;

  if (n >= MIN_INCIDENTS) {
    // Same hour of day (UTC).
    const byHour = new Map<number, number>();
    for (const i of incidents) {
      const h = new Date(i.started_at).getUTCHours();
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    }
    const [topHour, topCount] = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0]!;
    if (topCount >= 2 && topCount / n >= 0.5) {
      const hh = String(topHour).padStart(2, "0");
      const running = jobsInHour(jobs, topHour);
      patterns.push({
        key: "hour",
        title: `Slowdowns cluster around ${hh}:00 UTC`,
        detail: `${topCount} of ${n} incidents (${pct(topCount, n)}%) started between ${hh}:00 and ${hh}:59 UTC.${running.length ? ` Scheduled in that hour: ${running.join(", ")}.` : ""}`,
        suggestion: running.length ? "Move one of those jobs to a different hour, or split its work into smaller batches." : "Look at what else runs in that hour, such as imports or emails.",
      });
    }

    // Same cause.
    const byCause = new Map<IncidentCause, number>();
    for (const i of incidents) byCause.set(i.cause, (byCause.get(i.cause) ?? 0) + 1);
    const [topCause, causeCount] = [...byCause.entries()].sort((a, b) => b[1] - a[1])[0]!;
    if (causeCount >= 2 && causeCount / n >= 0.5) {
      patterns.push({
        key: "cause",
        title: `Most incidents have one cause: ${CAUSE_LABEL[topCause].toLowerCase()}`,
        detail: `${causeCount} of ${n} incidents (${pct(causeCount, n)}%).`,
        suggestion:
          topCause === "slow_query" ? "Find the query under Slowest queries and give it an index or a row limit."
          : topCause === "job_timeout" ? "Pause or reschedule the job that keeps timing out, or give it smaller batches."
          : topCause === "jobs_and_queries" ? "Stop jobs and long queries from overlapping, by moving the jobs to quieter hours."
          : "Check the Supabase Database report. If CPU, memory or disk is at the limit, add capacity.",
      });
    }
  }

  // Queries above normal need no incident history.
  const p90 = queryStats?.norms.p90_mean_ms ?? null;
  const slow = (queryStats?.top ?? []).map((q) => ({ q, v: queryVerdict(q.mean_ms, p90) })).filter((x) => x.v.verdict === "above");
  if (slow.length) {
    patterns.push({
      key: "queries",
      title: `${slow.length} of the ${queryStats!.top.length} most time consuming queries are above normal`,
      detail: slow.slice(0, 3).map((x) => `${labelQuery(x.q.q)}: ${fmtMs(x.q.mean_ms)} average, ${x.v.timesOver}x the normal limit of ${p90} ms`).join(". ") + ".",
      suggestion: "Each one needs an index or a row limit. Send the list to Claude to build.",
    });
  }

  return { patterns, incidents: n, needed: MIN_INCIDENTS };
}
