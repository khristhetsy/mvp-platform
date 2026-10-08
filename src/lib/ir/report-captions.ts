/**
 * One line under every chart and table in the founder outreach report, so a
 * founder reads each figure the way it is counted. Shared by the report page,
 * its PDF and the scheduled summary email, so all three say the same thing.
 *
 * Pure: built only from the report's own data (period, totals, as-of date).
 */
import { formatRange } from "@/lib/ir/milestones";
import type { ReportData } from "@/lib/ir/report";

type CaptionInput = Pick<ReportData, "period" | "pipeline" | "asOf" | "trend"> & { prevMetrics: unknown };

const matchedTotal = (d: Pick<ReportData, "pipeline">) => d.pipeline.reduce((s, p) => s + p.count, 0);
const asOfDate = (d: Pick<ReportData, "asOf">) => d.asOf.replace(/^As of\s+/i, "");
const investors = (n: number) => `${n} matched ${n === 1 ? "investor" : "investors"}`;

export function reportCaptions(d: CaptionInput) {
  const total = matchedTotal(d);
  const range = formatRange(d.period.start, d.period.end);
  return {
    /** Above the five figure cards on the admin Live view. */
    cards: `Figures for ${d.period.label} only${d.prevMetrics ? ", compared with the period before" : ""}.`,
    /** Outreach and meetings bar chart. */
    trend: `Introductions sent (blue) and meetings held (navy) in each ${d.trend.kind} of your project so far, to show the pace of outreach over time.`,
    /** Pipeline funnel chart. */
    funnel: `Where each of your ${investors(total)} stood on ${asOfDate(d)}, counted once at their current stage. This covers the whole project to date, so it can show more than this period's activity.`,
    /** Activity this period table. */
    activity: `What your team did from ${range} only. Investors contacted counts each investor once, however many times they were reached. Meetings booked are meetings put on the calendar in this period; meetings held are those that took place.${d.prevMetrics ? " Previous and Change compare with the period before." : ""}`,
    /** Investor pipeline at period end table, shown under the funnel. */
    pipelineTable: `The funnel above as numbers, with each stage's share of all ${investors(total)}.`,
    /** A pipeline list shown without the funnel (Live view, summary email). */
    pipelineAlone: `Each matched investor at their stage on ${asOfDate(d)}, across the whole project, not only this period.`,
    /** Upcoming meetings list. */
    upcoming: "Meetings on the calendar that have not happened yet, by firm and time (the next eight).",
  };
}
