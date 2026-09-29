/**
 * Founder-facing view of the IR report — server only. A founder sees only projects
 * linked to their company with `founder_report_visible` on, and only founder-safe fields
 * (spec §6): stage counts, dated activity descriptions, firm names once a meeting is
 * booked, IR notes marked founder-visible, and the approved executive summary of reports
 * that were actually sent. No investor names, no staff-only notes, no schedule settings.
 */
import { db, getProject } from "@/lib/ir/db";
import { isExecSummary, reportData, type ExecSummary, type ReportData, type ReportKind } from "@/lib/ir/report";
import type { IrProject } from "@/lib/ir/types";

export type FounderProject = { id: string; title: string; start_date: string; end_date: string; term_months: number };
export type FounderReportPayload = Omit<ReportData, "saved" | "schedule" | "founder"> & {
  founder: { name: string };
  sentReport: { id: string; sentAt: string; summary: ExecSummary } | null;
  sentReports: Array<{ id: string; period: string; kind: string; sentAt: string; bottom: string | null }>;
};

/** Projects the founder may see: linked to their company and shared by the IR team. */
export async function founderProjects(companyId: string): Promise<FounderProject[]> {
  const { data } = await db().from("ir_projects").select("id, title, start_date, end_date, term_months").eq("company_id", companyId).eq("founder_report_visible", true).neq("status", "cancelled").order("start_date", { ascending: false });
  return (data ?? []) as FounderProject[];
}

export async function founderMayView(companyId: string, projectId: string): Promise<IrProject | null> {
  const p = await getProject(projectId);
  return p && p.company_id === companyId && p.founder_report_visible && p.status !== "cancelled" ? p : null;
}

export async function founderReport(companyId: string, projectId: string, q: { kind: ReportKind; milestoneId?: string | null; start?: string | null; end?: string | null; compare: boolean }): Promise<{ data: FounderReportPayload | null; error?: string; status: number }> {
  const project = await founderMayView(companyId, projectId);
  if (!project) return { data: null, error: "No report is shared for this project.", status: 404 };
  const { data, error } = await reportData(projectId, q);
  if (!data) return { data: null, error, status: 400 };
  const { data: sent } = await db().from("ir_reports").select("id, period_kind, period_start, period_end, exec_summary, sent_at").eq("project_id", projectId).not("sent_at", "is", null).order("period_start", { ascending: false }).limit(24);
  const rows = (sent ?? []) as Array<{ id: string; period_kind: string; period_start: string; period_end: string; exec_summary: unknown; sent_at: string }>;
  const forPeriod = rows.find((r) => r.period_kind === data.period.kind && r.period_start === data.period.start && r.period_end === data.period.end);
  const { saved: _saved, schedule: _schedule, founder, ...rest } = data;
  void _saved; void _schedule;
  return {
    status: 200,
    data: {
      ...rest,
      founder: { name: founder.name },
      sentReport: forPeriod && isExecSummary(forPeriod.exec_summary) ? { id: forPeriod.id, sentAt: forPeriod.sent_at, summary: forPeriod.exec_summary } : null,
      sentReports: rows.map((r) => ({ id: r.id, kind: r.period_kind, period: `${r.period_start} to ${r.period_end}`, sentAt: r.sent_at, bottom: isExecSummary(r.exec_summary) ? r.exec_summary.bottom : null })),
    },
  };
}
