/**
 * Founder portal: download a report the IR team sent — the frozen, approved snapshot only.
 *   GET ?report=<ir_reports.id>
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getReport } from "@/lib/ir/db";
import { founderMayView } from "@/lib/ir/founder-report";
import { isExecSummary, type FrozenReport } from "@/lib/ir/report";
import { renderReportPdf } from "@/lib/ir/report-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  let profile;
  try { profile = await requireRole(["founder"]); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { company } = await getActiveCompanyForUser(profile);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const id = req.nextUrl.searchParams.get("report");
  if (!id) return NextResponse.json({ error: "Missing report." }, { status: 400 });
  try {
    const r = await getReport(id);
    if (!r || !r.sent_at || !r.approved_at || !isExecSummary(r.exec_summary) || !(await founderMayView(company.id, r.project_id))) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const frozen = r.metrics as unknown as FrozenReport;
    const pdf = await renderReportPdf(frozen, r.exec_summary);
    const name = `Investor-Outreach-Report-${frozen.project.title}-${r.period_start}`.replace(/[^\w.-]+/g, "-");
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't render the PDF." }, { status: 500 }); }
}
