import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import {
  flattenReportForCsv,
  generateAdminReport,
} from "@/lib/reports/admin-reports";
import { reportFilename, rowsToCsv } from "@/lib/reports/export";
import { adminReportGenerateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = adminReportGenerateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report request." }, { status: 400 });
  }

  const { reportType, format, preview, filters } = parsed.data;

  const payload = await generateAdminReport(auth.supabase, {
    reportType,
    filters,
    preview: preview ?? false,
  });

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
