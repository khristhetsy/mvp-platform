import { NextResponse } from "next/server";
import { loadSharedReport, recordShareView } from "@/lib/reports/report-shares";
import { renderDiligenceReportPdf } from "@/lib/reports/diligence-report-pdf";

export const dynamic = "force-dynamic";

/**
 * Public PDF of a shared diligence report. Same token rule as the share page:
 * an unknown or turned off link returns 404. Each download is counted.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await loadSharedReport(token);
  if (!shared) {
    return NextResponse.json({ error: "This link is no longer active." }, { status: 404 });
  }

  const pdf = await renderDiligenceReportPdf(shared.companyName, shared.report);
  await recordShareView(shared.shareId, "download");

  const safeName = shared.companyName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="diligence-report-${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
