import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { renderDiligenceReportPdf, type DiligenceReportRow } from "@/lib/reports/diligence-report-pdf";

export const dynamic = "force-dynamic";

/**
 * Founder-facing PDF of their latest AI diligence report.
 * Inline by default (so it can be printed from the browser's PDF viewer);
 * `?download=1` returns it as an attachment.
 */
export async function GET(request: Request) {
  const profile = await requireRole(["founder"]);
  const company = await ensureFounderCompanyForUser(profile);
  if (!company) {
    return NextResponse.json({ error: "No company profile is linked to your account." }, { status: 404 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: report } = await getLatestDiligenceReport(supabase, company.id);
  if (!report) {
    return NextResponse.json({ error: "No diligence report has been generated yet." }, { status: 404 });
  }

  const pdf = await renderDiligenceReportPdf(company.company_name, report as unknown as DiligenceReportRow);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const safeName = company.company_name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const fileName = `diligence-report-${safeName}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
