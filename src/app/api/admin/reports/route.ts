import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { writeAuditLog } from "@/lib/data/audit";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { recordOperationalError } from "@/lib/monitoring/operational-events";
import {
  flattenReportForCsv,
  generateAdminReport,
} from "@/lib/reports/admin-reports";
import { reportFilename, rowsToCsv } from "@/lib/reports/export";
import { buildDueDiligencePdf, buildSpvReadinessPdf } from "@/lib/reports/pdf-export";
import { renderDiligenceMemoPdf } from "@/lib/diligence/pdf";
import { serializeReport } from "@/lib/diligence/serialize";
import { findEngagementForCompany, loadReportExtras } from "@/lib/diligence/report-extras";
import { emptyReportPayload, type CompanySnapshot } from "@/lib/diligence/report-model";
import { canUser } from "@/lib/rbac/effective-permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { adminReportGenerateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const rateLimited = await enforceRateLimit({
    bucket: "admin_report_export",
    subjectId: auth.profile.id,
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimited) {
    return rateLimited;
  }

  const body = await request.json().catch(() => null);
  const parsed = adminReportGenerateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report request." }, { status: 400 });
  }

  const { reportType, format, preview, filters } = parsed.data;

  if (format === "pdf") {
    if (reportType !== "due_diligence" && reportType !== "spv_readiness") {
      return NextResponse.json(
        { error: "PDF export is only available for Due Diligence and SPV Readiness reports." },
        { status: 400 },
      );
    }
    if (preview) {
      return NextResponse.json(
        { error: "PDF preview is not supported. Download the PDF export instead." },
        { status: 400 },
      );
    }
  }

  let payload;
  try {
    payload = await generateAdminReport(auth.supabase, {
      reportType,
      filters,
      preview: preview ?? false,
    });
  } catch (error) {
    recordOperationalError("admin.report_export_failed", error, {
      reportType,
      format,
      userId: auth.profile.id,
    });
    return NextResponse.json({ error: "Unable to generate report." }, { status: 500 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.report_generated",
    entityType: "admin_report",
    entityId: reportType,
    metadata: {
      reportType,
      format,
      preview: preview ?? false,
      filters: filters ?? {},
      generatedAt: payload.meta.generatedAt,
      generatedBy: auth.profile.id,
    },
  });

  emitOperationalEvent(auth.supabase, {
    eventType: "report_generated",
    eventCategory: "reporting",
    entityType: "admin_report",
    entityId: null,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    title: `Report generated: ${reportType}`,
    sourceModule: "admin_reports",
    visibility: "admin_only",
    dedupeKey: `report:${reportType}:${format}:${preview ? "preview" : "export"}:${auth.profile.id}:${new Date().toISOString().slice(0, 16)}`,
    metadata: { reportType, format, preview: preview ?? false },
  });

  if (format === "pdf") {
    const pdfContext = {
      generatedBy:
        auth.profile.full_name ?? auth.profile.email ?? auth.profile.id,
    };
    let pdfBuffer: Buffer;
    try {
      const singleCompanyId = reportType === "due_diligence" ? filters?.companyId : undefined;
      pdfBuffer =
        reportType === "spv_readiness"
          ? await buildSpvReadinessPdf(payload, pdfContext)
          : singleCompanyId
            ? await buildSingleCompanyDiligencePdf(auth.profile.id, auth.profile, singleCompanyId, payload, pdfContext.generatedBy)
            : await buildDueDiligencePdf(payload, pdfContext);
    } catch (error) {
      recordOperationalError("admin.report_pdf_export_failed", error, {
        reportType,
        userId: auth.profile.id,
      });
      return NextResponse.json({ error: "Unable to generate PDF export." }, { status: 500 });
    }
    const filename = reportFilename(reportType, "pdf");

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "csv") {
    const rows = flattenReportForCsv(payload);
    const csv = rowsToCsv(rows);
    const filename = reportFilename(reportType, "csv");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (preview) {
    return NextResponse.json({ report: payload });
  }

  const filename = reportFilename(reportType, "json");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * One company selected: render the v2 diligence report (engagement findings, claims,
 * responses) with the company's platform metrics. Engagement detail is included only
 * for staff holding manage_diligence; others get the company summary alone.
 */
async function buildSingleCompanyDiligencePdf(
  userId: string,
  profile: Parameters<typeof canUser>[3],
  companyId: string,
  payload: Awaited<ReturnType<typeof generateAdminReport>>,
  generatedBy: string,
): Promise<Buffer> {
  const snapshot = (payload.sections.company_diligence?.[0] as CompanySnapshot | undefined) ?? null;
  const companyName = String(snapshot?.company_name ?? "Company");
  const service = createServiceRoleClient();
  const canSeeDiligence = await canUser(service, userId, "manage_diligence", profile);
  const engagement = canSeeDiligence ? await findEngagementForCompany(service, companyId) : null;
  const report = engagement ? await serializeReport(service, engagement.id, "admin") : null;
  if (engagement && report) {
    const extras = await loadReportExtras(service, engagement.id, "admin");
    return renderDiligenceMemoPdf(report, "admin", { ...extras, snapshot, generatedBy });
  }
  return renderDiligenceMemoPdf(emptyReportPayload(companyName), "admin", { snapshot, generatedBy, noEngagement: canSeeDiligence });
}
