import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { buildDeliveryLogsExport } from "@/lib/integrations/export-logs";
import { writeAuditLog } from "@/lib/data/audit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

  const exported = await buildDeliveryLogsExport(format);

  const supabase = createServiceRoleClient();
  await writeAuditLog(supabase, {
    userId: auth.profile.id,
    action: "admin.integration_delivery_export",
    entityType: "integration_delivery_logs",
    metadata: { format, exportedAt: new Date().toISOString() },
  });

  if (format === "json") {
    return new NextResponse(exported.body, {
      status: 200,
      headers: {
        "Content-Type": exported.contentType,
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
      },
    });
  }

  return new NextResponse(exported.body, {
    status: 200,
    headers: {
      "Content-Type": exported.contentType,
      "Content-Disposition": `attachment; filename="${exported.filename}"`,
    },
  });
}
