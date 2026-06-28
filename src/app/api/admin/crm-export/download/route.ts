import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { logCrmExportDownloaded } from "@/lib/crm-connectors/audit";
import {
  buildCrmExportPackage,
  crmPackageToCsv,
  crmPackageToJson,
} from "@/lib/crm-connectors/export-builder";
import { parseCrmExportEntityType, parseCrmExportFormat, validateExportRowCount } from "@/lib/crm-connectors/validation";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const params = new URL(request.url).searchParams;
  const entityType = parseCrmExportEntityType(params.get("entityType"));
  const format = parseCrmExportFormat(params.get("format"));

  if (!entityType) {
    return NextResponse.json({ error: "Invalid entityType." }, { status: 400 });
  }

  const pkg = await buildCrmExportPackage(entityType, format);
  const countError = validateExportRowCount(pkg.rowCount);
  if (countError) {
    return NextResponse.json({ error: countError }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  await logCrmExportDownloaded(supabase, auth.profile, {
    entityType,
    rowCount: pkg.rowCount,
    format,
  });

  const date = pkg.generatedAt.slice(0, 10);
  const slug = entityType.replace(/_/g, "-");
  const filename = `capitalos-crm-${slug}-${date}.${format}`;

  if (format === "json") {
    return new NextResponse(crmPackageToJson(pkg), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-iCapOS-CRM-Sync": "disabled",
      },
    });
  }

  return new NextResponse(crmPackageToCsv(pkg), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-iCapOS-CRM-Sync": "disabled",
    },
  });
}
