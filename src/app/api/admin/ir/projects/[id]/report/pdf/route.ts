/**
 * Download the founder report as PDF.
 *   GET ?report=<ir_reports.id>            → the frozen, approved snapshot
 *   GET ?kind&milestone&start&end          → a live preview built from current data (watermarked "Draft")
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { getReport } from "@/lib/ir/db";
import { fallbackSummary, freeze, isExecSummary, reportData, type FrozenReport, type ReportKind } from "@/lib/ir/report";
import { renderReportPdf } from "@/lib/ir/report-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  try {
    let frozen: FrozenReport; let summary; let name: string;
    const reportId = sp.get("report");
    if (reportId) {
      const r = await getReport(reportId);
      if (!r || r.project_id !== id) return NextResponse.json({ error: "Report not found." }, { status: 404 });
      frozen = r.metrics as unknown as FrozenReport;
      summary = isExecSummary(r.exec_summary) ? r.exec_summary : fallbackSummary({ ...frozen, summary: "", options: { weeks: [], months: [] }, saved: r, schedule: { weekly: false, monthly: false, sends: [] } });
      name = `Investor-Outreach-Report-${frozen.project.title}-${r.period_start}`;
    } else {
      const kind = (sp.get("kind") ?? "week") as ReportKind;
      const { data, error } = await reportData(id, { kind, milestoneId: sp.get("milestone"), start: sp.get("start"), end: sp.get("end"), compare: sp.get("compare") !== "0" });
      if (!data) return NextResponse.json({ error: error ?? "Couldn't build the report." }, { status: 400 });
      frozen = freeze(data);
      summary = data.saved && isExecSummary(data.saved.exec_summary) ? data.saved.exec_summary : fallbackSummary(data);
      name = `Investor-Outreach-Report-${data.project.title}-${data.period.start}-draft`;
    }
    const pdf = await renderReportPdf(frozen, summary);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name.replace(/[^\w.-]+/g, "-")}.pdf"` } });
  } catch (e) { return failed(e, "Couldn't render the PDF."); }
}
