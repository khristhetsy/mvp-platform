import { NextResponse } from "next/server";
import { getAuditComplianceTimeline } from "@/lib/audit-compliance/audit-trail";
import { buildComplianceEvidencePack } from "@/lib/audit-compliance/evidence";
import {
  auditExportFilename,
  auditExportToCsv,
  buildAuditExportPayload,
} from "@/lib/audit-compliance/export-summary";
import { parseAuditComplianceFilters } from "@/lib/audit-compliance/filters";
import { getAuditRiskSummary } from "@/lib/audit-compliance/risk-summary";
import type { AuditEvidenceEntityType } from "@/lib/audit-compliance/types";
import { AUDIT_EVIDENCE_ENTITY_TYPES } from "@/lib/audit-compliance/types";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { bridgeAuditExportGenerated } from "@/lib/integrations/emit-bridge";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const filters = parseAuditComplianceFilters(url.searchParams);

  const entityType = url.searchParams.get("entityType") as AuditEvidenceEntityType | null;
  const entityId = url.searchParams.get("entityId");

  const supabase = createServiceRoleClient();

  try {
    const [timeline, riskSummary] = await Promise.all([
      getAuditComplianceTimeline(supabase, filters),
      getAuditRiskSummary(supabase),
    ]);

    let evidencePack = null;
    if (
      entityType &&
      entityId &&
      AUDIT_EVIDENCE_ENTITY_TYPES.includes(entityType)
    ) {
      evidencePack = await buildComplianceEvidencePack(supabase, entityType, entityId);
    }

    const payload = buildAuditExportPayload({
      filters,
      riskSummary,
      timeline,
      evidencePack,
    });

    await writeAuditLog(supabase, {
      userId: auth.profile.id,
      action: "admin.audit_export_generated",
      entityType: entityType ?? "audit_compliance",
      entityId: entityId ?? null,
      metadata: {
        format,
        filters,
        timelineCount: timeline.length,
        exportedAt: payload.exportedAt,
      },
    });

    bridgeAuditExportGenerated(auth.profile.id, format);

    if (format === "csv") {
      const csv = auditExportToCsv(payload);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${auditExportFilename("csv", entityType ?? undefined)}"`,
        },
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Audit export failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
