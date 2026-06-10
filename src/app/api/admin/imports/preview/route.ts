import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { createImportBatch } from "@/lib/imports/batches";
import { applyColumnMapping, autoMapColumns } from "@/lib/imports/column-mapping";
import { parseSpreadsheetBuffer, toParsedImportRows } from "@/lib/imports/parse";
import type { ImportType } from "@/lib/imports/types";
import { IMPORT_FIELD_DEFINITIONS } from "@/lib/imports/types";
import {
  buildSuggestedMapping,
  loadImportContext,
  validateImportRows,
} from "@/lib/imports/validation";
import { adminImportPreviewSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const file = formData.get("file");
  const importTypeRaw = formData.get("importType");
  const mappingRaw = formData.get("mapping");

  const parsedMeta = adminImportPreviewSchema.safeParse({
    importType: importTypeRaw,
    mapping: mappingRaw ? JSON.parse(String(mappingRaw)) : undefined,
  });

  if (!parsedMeta.success || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid import preview request." }, { status: 400 });
  }

  const importType = parsedMeta.data.importType as ImportType;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { headers, rows } = await parseSpreadsheetBuffer(buffer, file.name);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No data rows found in uploaded file." }, { status: 400 });
  }

  const targetFields = IMPORT_FIELD_DEFINITIONS[importType].map((field) => field.field);
  const mapping =
    parsedMeta.data.mapping ??
    buildSuggestedMapping(headers, importType) ??
    autoMapColumns(headers, targetFields);

  const context = await loadImportContext(auth.supabase, importType);
  const preview = validateImportRows({
    importType,
    fileName: file.name,
    headers,
    parsedRows: toParsedImportRows(rows).map((row) => ({
      ...row,
      mapped: applyColumnMapping(row.raw, mapping),
    })),
    mapping,
    context,
  });

  const batch = await createImportBatch(auth.supabase, {
    uploadedBy: auth.profile.id,
    importType,
    fileName: file.name,
    preview,
    mapping,
  });

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.import_previewed",
    entityType: "import_batch",
    entityId: batch.id,
    metadata: {
      importType,
      fileName: file.name,
      uploadedBy: auth.profile.id,
      rowCounts: preview.counts,
      format: file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv",
      timestamp: new Date().toISOString(),
    },
  });

  emitOperationalEvent(auth.supabase, {
    eventType: "import_previewed",
    eventCategory: "imports",
    entityType: "import_batch",
    entityId: batch.id,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    title: `Import preview: ${importType}`,
    sourceModule: "admin_imports",
    visibility: "admin_only",
    dedupeKey: `import_preview:${batch.id}`,
    metadata: {
      importType,
      fileName: file.name,
      rowCounts: preview.counts,
    },
  });

  return NextResponse.json({
    batchId: batch.id,
    preview: {
      ...preview,
      rows: preview.rows.slice(0, 100),
    },
  });
}
