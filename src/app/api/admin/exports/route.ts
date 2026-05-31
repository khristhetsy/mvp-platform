import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { generateAdminExport } from "@/lib/imports/export";
import type { ExportFormat, ExportType } from "@/lib/imports/types";
import { adminExportQuerySchema } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const parsed = adminExportQuerySchema.safeParse({
    type: url.searchParams.get("type"),
    format: url.searchParams.get("format") ?? "csv",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
  }

  const exportType = parsed.data.type as ExportType;
  const format = parsed.data.format as ExportFormat;

  let payload;
  try {
    payload = await generateAdminExport(auth.supabase, exportType, format);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate export." },
      { status: 500 },
    );
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.export_generated",
    entityType: "admin_export",
    entityId: exportType,
    metadata: {
      exportType,
      format,
      generatedBy: auth.profile.id,
      timestamp: new Date().toISOString(),
    },
  });

  emitOperationalEvent(auth.supabase, {
    eventType: "export_generated",
    eventCategory: "imports",
    entityType: "admin_export",
    entityId: null,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    title: `Export generated: ${exportType}`,
    sourceModule: "admin_exports",
    visibility: "admin_only",
    dedupeKey: `export:${exportType}:${format}:${auth.profile.id}:${new Date().toISOString().slice(0, 16)}`,
    metadata: { exportType, format },
  });

  const body: BodyInit =
    payload.body instanceof Buffer
      ? new Uint8Array(payload.body)
      : typeof payload.body === "string"
        ? payload.body
        : new Uint8Array(payload.body as Buffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": payload.contentType,
      "Content-Disposition": `attachment; filename="${payload.filename}"`,
    },
  });
}
