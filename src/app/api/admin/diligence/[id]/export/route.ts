import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { serializeReport } from "@/lib/diligence/serialize";
import { renderDiligenceMemoPdf } from "@/lib/diligence/pdf";
import { loadReportExtras } from "@/lib/diligence/report-extras";
import { generateAdminReport } from "@/lib/reports/admin-reports";
import type { CompanySnapshot } from "@/lib/diligence/report-model";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — admin-full diligence memo as a PDF. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requirePermissionApi("manage_diligence");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const payload = await serializeReport(auth.supabase, id, "admin");
  if (!payload) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const extras = await loadReportExtras(auth.supabase, id, "admin");
  // Company metrics (readiness, remediation, investor activity) when the engagement is linked to a company record.
  let snapshot: CompanySnapshot | null = null;
  const companyId = payload.engagement.company_id ? String(payload.engagement.company_id) : null;
  if (companyId) {
    const report = await generateAdminReport(auth.supabase, { reportType: "due_diligence", filters: { companyId }, preview: false });
    snapshot = (report.sections.company_diligence?.[0] as CompanySnapshot | undefined) ?? null;
  }
  const generatedBy = auth.profile.full_name ?? auth.profile.email ?? null;
  const pdf = await renderDiligenceMemoPdf(payload, "admin", { ...extras, snapshot, generatedBy });
  const name = `diligence-${String(payload.engagement.report_code ?? id)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` },
  });
}
