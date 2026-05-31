import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { emitOperationalEvent } from "@/lib/operational-activity/create-event";
import { finalizeImportBatch } from "@/lib/imports/batches";
import type { ImportContextIndex } from "@/lib/imports/dedupe";
import { executeImportRows } from "@/lib/imports/execute";
import type { ImportType, ValidatedImportRow } from "@/lib/imports/types";
import { loadImportContext } from "@/lib/imports/validation";
import { adminImportConfirmSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = adminImportConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid import confirm request." }, { status: 400 });
  }

  const { batchId, duplicateBehavior } = parsed.data;

  const { data: batch, error: batchError } = await auth.supabase
    .from("import_batches")
    .select("*")
    .eq("id", batchId)
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
  }

  if (batch.status === "completed") {
    return NextResponse.json({ error: "Import batch already completed." }, { status: 409 });
  }

  const { data: batchRows, error: rowsError } = await auth.supabase
    .from("import_batch_rows")
    .select("*")
    .eq("batch_id", batchId)
    .order("row_number", { ascending: true });

  if (rowsError) {
    return NextResponse.json({ error: "Unable to load import rows." }, { status: 500 });
  }

  const importType = batch.import_type as ImportType;
  const context: ImportContextIndex = await loadImportContext(auth.supabase, importType);

  const rows: ValidatedImportRow[] = (batchRows ?? [])
    .filter((row) => row.status !== "error")
    .map((row) => ({
      rowNumber: row.row_number,
      raw: (row.raw_data as Record<string, string>) ?? {},
      mapped: (row.mapped_data as Record<string, string>) ?? {},
      status: row.status as ValidatedImportRow["status"],
      errors: (row.errors as string[]) ?? [],
      warnings: (row.warnings as string[]) ?? [],
    }));

  const result = await executeImportRows({
    supabase: auth.supabase,
    importType,
    rows,
    context,
    duplicateBehavior,
    batchId,
  });

  await finalizeImportBatch(auth.supabase, batchId, result);

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "admin.import_confirmed",
    entityType: "import_batch",
    entityId: batchId,
    metadata: {
      importType,
      uploadedBy: batch.uploaded_by,
      confirmedBy: auth.profile.id,
      duplicateBehavior,
      rowCounts: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      },
      timestamp: new Date().toISOString(),
    },
  });

  emitOperationalEvent(auth.supabase, {
    eventType: "import_completed",
    eventCategory: "imports",
    entityType: "import_batch",
    entityId: batchId,
    actorUserId: auth.profile.id,
    actorRole: auth.profile.role,
    title: `Import completed: ${importType}`,
    sourceModule: "admin_imports",
    visibility: "admin_only",
    dedupeKey: `import_completed:${batchId}`,
    metadata: {
      importType,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
    },
  });

  return NextResponse.json({ batchId, result });
}
