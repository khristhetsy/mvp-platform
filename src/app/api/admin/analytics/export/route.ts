import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { analyticsSnapshotToCsv } from "@/lib/analytics/exports";
import { clampTrendWindowDays } from "@/lib/analytics/display";
import { loadPlatformAnalyticsSnapshot } from "@/lib/analytics/metrics";
import { writeAuditLog } from "@/lib/data/audit";

export async function GET(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const windowDays = clampTrendWindowDays(url.searchParams.get("window"));

  const supabase = createServiceRoleClient();
  const snapshot = await loadPlatformAnalyticsSnapshot(supabase, windowDays);

  await writeAuditLog(supabase, {
    userId: auth.profile.id,
    action: "admin.analytics_export_generated",
    entityType: "analytics",
    entityId: null,
    metadata: {
      format,
      windowDays,
      generatedAt: snapshot.generatedAt,
    },
  });

  if (format === "csv") {
    const csv = analyticsSnapshotToCsv(snapshot);
    const filename = `icapos_analytics_${windowDays}d_${snapshot.generatedAt.slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json(snapshot);
}

