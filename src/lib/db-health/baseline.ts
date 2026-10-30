/**
 * What is normal, from your own readings. No database access, so it can be tested.
 *
 * Live tiles: normal is the 7 day average plus or minus one standard deviation.
 * It needs 7 days of readings; until then the page says it is building one.
 * Query averages: normal is at or below the 90th percentile of your own queries.
 */

export type Verdict = "below" | "normal" | "above";

export const BASELINE_DAYS = 7;

export type NormalRange = { avg: number; lo: number; hi: number; n: number };

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Population standard deviation. */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

/** Days of readings held, from the oldest reading to now. */
export function daysCovered(oldestIso: string | null, now: number): number {
  if (!oldestIso) return 0;
  const t = new Date(oldestIso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now - t) / 86_400_000);
}

export function baselineReady(oldestIso: string | null, now: number): boolean {
  return daysCovered(oldestIso, now) >= BASELINE_DAYS;
}

/** The normal range, or null when there are too few readings to say. */
export function normalRange(values: number[], minReadings = 24): NormalRange | null {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length < minReadings) return null;
  const avg = mean(xs);
  const sd = stdev(xs);
  return { avg, lo: Math.max(0, avg - sd), hi: avg + sd, n: xs.length };
}

export function verdictFor(value: number, range: NormalRange): Verdict {
  if (value > range.hi) return "above";
  if (value < range.lo) return "below";
  return "normal";
}

export const VERDICT_LABEL: Record<Verdict, string> = { above: "Above normal", normal: "Normal", below: "Below normal" };

/** Change against the average, in whole percent. Null when the average is 0. */
export function diffPercent(value: number, avg: number): number | null {
  return avg > 0 ? Math.round(((value - avg) / avg) * 100) : null;
}

export function percentOfLimit(value: number, limit: number): number | null {
  return limit > 0 ? Math.round((value / limit) * 100) : null;
}

/** A query's average against the 90th percentile of all queries. */
export function queryVerdict(meanMs: number, p90Ms: number | null): { verdict: Verdict | null; timesOver: number | null } {
  if (p90Ms === null || p90Ms <= 0) return { verdict: null, timesOver: null };
  return { verdict: meanMs > p90Ms ? "above" : "normal", timesOver: Math.round((meanMs / p90Ms) * 10) / 10 };
}

/** A readable name for a normalised SQL statement. Falls back to the start of the SQL. */
export function labelQuery(sql: string): string {
  const q = sql.toLowerCase();
  if (q.includes("wal->>") || q.includes("realtime.")) return "Realtime change polling";
  if (q.includes("pg_timezone_names")) return "Timezone name list";
  if (q.includes("pg_namespace") || q.includes("pg_class") || q.includes("pg_proc") || q.includes("pg_catalog")) {
    return q.includes("crm_contacts") ? "Contacts" : "Schema lookups by tools";
  }
  if (q.includes("flag_unapplied_payments")) return "Unapplied payments flag";
  if (q.includes("set_config(")) return "Request setup";
  if (q.includes("crm_contacts")) return q.includes("email_status") ? "Contact search by email status" : "Contact search";
  if (q.includes("pgrst_call")) return "Database function call";
  return sql.replace(/\s+/g, " ").slice(0, 60);
}
