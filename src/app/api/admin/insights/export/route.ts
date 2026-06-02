import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { loadPlatformInsights } from "@/lib/predictive-intelligence/signals";
import { clampTrendWindowDays } from "@/lib/analytics/display";
import { insightsSnapshotToCsv } from "@/lib/predictive-intelligence/display";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const windowDays = clampTrendWindowDays(url.searchParams.get("window"));

  const snapshot = await loadPlatformInsights({ window: String(windowDays) });
  const supabase = createServiceRoleClient();

  await writeAuditLog(supabase, {
    userId: auth.profile.id,
    action: "admin.insights_export_generated",
    entityType: "insights",
    entityId: null,
    metadata: {
      format,
      windowDays,
      generatedAt: snapshot.generatedAt,
      signalCount: snapshot.signals.length,
      recommendationCount: snapshot.recommendations.length,
    },
  });

  if (format === "csv") {
    const csv = insightsSnapshotToCsv({
      generatedAt: snapshot.generatedAt,
      windowDays: snapshot.windowDays,
      signals: snapshot.signals.map((s) => ({
        id: s.id,
        type: s.type,
        severity: s.severity,
        score: s.score,
        confidence: s.confidence,
        title: s.title,
        entityType: s.entityType,
        entityId: s.entityId,
        href: s.href,
      })),
      recommendations: snapshot.recommendations.map((r) => ({
        id: r.id,
        priority: r.priority,
        title: r.title,
        href: r.href,
        entityType: r.entityType,
        entityId: r.entityId,
        sourceSignalType: r.sourceSignalType,
      })),
    });

    const filename = `capitalos_insights_${windowDays}d_${snapshot.generatedAt.slice(0, 10)}.csv`;
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

