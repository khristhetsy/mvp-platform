import type { MetricDetail } from "@/components/ui/MetricDetailDrawer";
import type { MetricChartData } from "@/components/ui/MetricChart";
import {
  BASELINE_DAYS,
  VERDICT_LABEL,
  daysCovered,
  diffPercent,
  normalRange,
  percentOfLimit,
  verdictFor,
  type NormalRange,
} from "@/lib/db-health/baseline";
import type { HealthSettings } from "@/lib/db-health/evaluate";
import type { JobTimeouts, SampleRow } from "@/lib/db-health/load";

export type TileModel = {
  key: "response" | "query" | "connections" | "timeouts";
  label: string;
  value: string;
  unit?: string;
  detail: string;
  ring: { percent: number | null; center?: string; sublabel?: string; color?: string; pending?: boolean; title?: string };
  flag: { text: string; tone: "good" | "warn" | "bad" } | null;
  detailPanel: MetricDetail;
};

const DAY = 86_400_000;
const GREEN = "#15803d", AMBER = "#b45309", RED = "#b91c1c";

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return Number.isInteger(s) ? `${s} s` : `${s.toFixed(s < 10 ? 1 : 0)} s`;
}

function describeNormal(value: number, range: NormalRange | null, days: number, fmt: (v: number) => string): { line: string; rows: { label: string; value: string; tone?: "good" | "warn" | "bad" }[] } {
  if (!range) {
    const rows = [{ label: "Normal range", value: `Building, ${Math.min(Math.floor(days), BASELINE_DAYS)} of ${BASELINE_DAYS} days of readings` }];
    return { line: `Building a baseline, ${Math.min(Math.floor(days), BASELINE_DAYS)} of ${BASELINE_DAYS} days`, rows };
  }
  const v = verdictFor(value, range);
  const d = diffPercent(value, range.avg);
  const pct = d === null ? "" : `${d > 0 ? "+" : ""}${d}% vs 7 day average`;
  return {
    line: `${VERDICT_LABEL[v]}${pct ? `, ${pct}` : ""}`,
    rows: [
      { label: "Verdict", value: VERDICT_LABEL[v], tone: v === "above" ? "bad" : v === "normal" ? "good" : undefined },
      { label: "7 day average", value: fmt(range.avg) },
      { label: "Normal range", value: `${fmt(range.lo)} to ${fmt(range.hi)}` },
    ],
  };
}

/** The four tiles at the top of the page, from the readings. Returns null tiles when nothing is measured yet. */
export function buildTiles(input: {
  now: number;
  settings: HealthSettings;
  samples: SampleRow[];
  jobs: JobTimeouts[];
}): TileModel[] | null {
  const { now, settings, samples, jobs } = input;
  const latest = samples[samples.length - 1];
  if (!latest) return null;

  const days = daysCovered(samples[0]?.taken_at ?? null, now);
  const ready = days >= BASELINE_DAYS;
  const last24 = samples.filter((s) => now - new Date(s.taken_at).getTime() <= DAY);
  const when = `Checked ${new Date(latest.taken_at).toISOString().slice(11, 16)} UTC, every 5 minutes`;

  // 1. Response time
  const respVals = samples.map((s) => s.response_ms).filter((v): v is number => v !== null);
  const respRange = ready ? normalRange(respVals) : null;
  const resp = latest.response_ms;
  const respNormal = resp === null ? null : describeNormal(resp, respRange, days, fmtMs);
  const respPct = resp === null ? null : percentOfLimit(resp, settings.overloadMs);
  const respFlag: TileModel["flag"] =
    resp === null
      ? { text: "The test query failed", tone: "bad" }
      : resp >= settings.overloadMs
        ? { text: `Over the ${fmtMs(settings.overloadMs)} overload limit`, tone: "bad" }
        : resp >= settings.warnMs
          ? { text: `Over the ${fmtMs(settings.warnMs)} warning limit`, tone: "warn" }
          : { text: `Inside the ${fmtMs(settings.warnMs)} warning limit`, tone: "good" };
  const respChart: MetricChartData = {
    values: last24.map((s) => s.response_ms).filter((v): v is number => v !== null).map((v) => v / 1000),
    max: Math.max(8, Math.ceil(Math.max(0, ...last24.map((s) => (s.response_ms ?? 0) / 1000)))),
    unit: "s",
    limits: [
      { value: settings.warnMs / 1000, label: `warn ${fmtMs(settings.warnMs)}`, tone: "warn" },
      { value: settings.overloadMs / 1000, label: `overload ${fmtMs(settings.overloadMs)}`, tone: "bad" },
    ],
    band: respRange ? { lo: respRange.lo / 1000, hi: respRange.hi / 1000, avg: respRange.avg / 1000 } : undefined,
    startLabel: "24 hours ago",
  };

  // 2. Longest running query
  const queryVals = samples.map((s) => s.longest_query_s ?? 0);
  const queryRange = ready ? normalRange(queryVals) : null;
  const q = latest.longest_query_s ?? 0;
  const qNormal = describeNormal(q, queryRange, days, (v) => `${v.toFixed(1)} s`);
  const qPct = percentOfLimit(q, settings.queryLimitS);
  const qChart: MetricChartData = {
    values: last24.map((s) => s.longest_query_s ?? 0),
    max: Math.max(settings.queryLimitS * 1.25, Math.ceil(Math.max(0, ...last24.map((s) => s.longest_query_s ?? 0)))),
    unit: "s",
    limits: [{ value: settings.queryLimitS, label: `query limit ${settings.queryLimitS} s`, tone: "bad" }],
    band: queryRange ? { lo: queryRange.lo, hi: queryRange.hi, avg: queryRange.avg } : undefined,
    startLabel: "24 hours ago",
  };

  // 3. Connections
  const connVals = samples.map((s) => s.active_connections).filter((v): v is number => v !== null);
  const connRange = ready ? normalRange(connVals) : null;
  const conn = latest.active_connections;
  const connNormal = conn === null ? null : describeNormal(conn, connRange, days, (v) => String(Math.round(v)));
  const connChart: MetricChartData = {
    values: last24.map((s) => s.active_connections).filter((v): v is number => v !== null),
    max: Math.max(10, Math.ceil(Math.max(0, ...connVals.slice(-288)) * 1.2)),
    unit: "",
    band: connRange ? { lo: connRange.lo, hi: connRange.hi, avg: connRange.avg } : undefined,
    startLabel: "24 hours ago",
  };

  // 4. Cron timeouts, last 24 hours, from the run log
  const timeouts = jobs.reduce((n, j) => n + j.timeouts, 0);
  const runs = jobs.reduce((n, j) => n + j.runs, 0);
  const timedOut = jobs.filter((j) => j.timeouts > 0);

  return [
    {
      key: "response",
      label: "Response time",
      value: resp === null ? "Failed" : fmtMs(resp),
      unit: `of ${fmtMs(settings.overloadMs)} overload limit`,
      detail: `${respNormal?.line ?? "The test query failed"}. ${when}.`,
      ring: respPct === null ? { percent: null, pending: true, title: "The test query failed" } : { percent: Math.min(100, respPct), center: `${respPct}%`, sublabel: "of limit", color: respPct >= 100 ? RED : resp! >= settings.warnMs ? AMBER : GREEN, title: `${fmtMs(resp!)} against a ${fmtMs(settings.overloadMs)} limit` },
      flag: respFlag,
      detailPanel: {
        note: "Time for a simple test query through the API, the same path the app uses. Signed in requests are cancelled by the database at 8 s.",
        chart: respChart,
        breakdown: [
          { label: "Latest reading", value: resp === null ? "Failed" : fmtMs(resp) },
          ...(respNormal?.rows ?? []),
          { label: "Warning limit", value: fmtMs(settings.warnMs) },
          { label: "Overload limit", value: fmtMs(settings.overloadMs) },
          { label: "Should be", value: `Under ${fmtMs(settings.warnMs)}`, tone: "good" },
        ],
      },
    },
    {
      key: "query",
      label: "Longest running query",
      value: latest.longest_query_s === null ? "None" : `${q.toFixed(q < 10 ? 1 : 0)} s`,
      unit: `of ${settings.queryLimitS} s limit`,
      detail: `${qNormal.line}. ${when}.`,
      ring: { percent: Math.min(100, qPct ?? 0), center: `${qPct ?? 0}%`, sublabel: "of limit", color: (qPct ?? 0) >= 100 ? RED : GREEN, title: `${q.toFixed(1)} s against a ${settings.queryLimitS} s limit` },
      flag: q >= settings.queryLimitS ? { text: `Over the ${settings.queryLimitS} s query limit`, tone: "bad" } : { text: `Inside the ${settings.queryLimitS} s query limit`, tone: "good" },
      detailPanel: {
        note: "The longest query running at the moment of the check. Scheduled jobs stop at 60 s.",
        chart: qChart,
        breakdown: [
          { label: "Latest reading", value: latest.longest_query_s === null ? "No query running" : `${q.toFixed(1)} s` },
          ...qNormal.rows,
          { label: "Query limit", value: `${settings.queryLimitS} s` },
          { label: "Should be", value: `Under ${settings.queryLimitS} s`, tone: "good" },
        ],
      },
    },
    {
      key: "connections",
      label: "Open connections",
      value: conn === null ? "Not read" : String(conn),
      unit: "open now",
      detail: `${connNormal?.line ?? "The connection count could not be read"}. ${when}.`,
      ring: { percent: null, pending: true, title: "No connection limit is read from the plan, so there is no scale" },
      flag: null,
      detailPanel: {
        note: "Client connections open at the moment of the check, idle ones included. The limit comes from your Supabase plan and is not read here.",
        chart: connChart,
        breakdown: [
          { label: "Latest reading", value: conn === null ? "Not read" : String(conn) },
          ...(connNormal?.rows ?? []),
        ],
      },
    },
    {
      key: "timeouts",
      label: "Cron timeouts, 24h",
      value: String(timeouts),
      unit: `of ${runs} runs`,
      detail: timeouts ? `Timed out: ${timedOut.map((j) => j.name).join(", ")}. From the Scheduled jobs run log.` : "No job timed out. From the Scheduled jobs run log.",
      ring: { percent: runs ? Math.round((timeouts / runs) * 1000) / 10 : null, center: runs ? `${((timeouts / runs) * 100).toFixed(1)}%` : "n/a", sublabel: "of runs", color: timeouts ? RED : GREEN, title: `${timeouts} of ${runs} runs` },
      flag: timeouts ? { text: `${timeouts} job${timeouts === 1 ? "" : "s"} did not finish`, tone: "bad" } : { text: "Every job finished", tone: "good" },
      detailPanel: {
        note: "A job counts as timed out when it started and was still running 6 minutes later, the same rule Scheduled jobs uses. It should be 0.",
        breakdown: [
          ...timedOut.map((j) => ({ label: j.name, value: `${j.timeouts} of ${j.runs} runs`, tone: "bad" as const })),
          { label: "All jobs, 24 hours", value: `${timeouts} of ${runs} runs` },
          { label: "Should be", value: "0 timeouts", tone: "good" },
        ],
        href: "/admin/scheduled-jobs",
        hrefLabel: "Open Scheduled jobs",
      },
    },
  ];
}
