import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportPreviewResult } from "@/lib/imports/types";

export async function createImportBatch(
  supabase: SupabaseClient,
  input: {
    uploadedBy: string;
    importType: string;
    fileName: string;
    preview: ImportPreviewResult;
    mapping: Record<string, string>;
  },
) {
  const { data: batch, error } = await supabase
    .from("import_batches")
    .insert({
      uploaded_by: input.uploadedBy,
      import_type: input.importType,
      file_name: input.fileName,
      status: "validated",
      total_rows: input.preview.counts.total,
      valid_rows: input.preview.counts.valid,
      warning_rows: input.preview.counts.warning,
      error_rows: input.preview.counts.error,
      mapping: input.mapping,
      summary: input.preview.counts,
    })
    .select("*")
    .single();

  if (error || !batch) {
    throw new Error(error?.message ?? "Failed to create import batch");
  }

  const rowRecords = input.preview.rows.map((row) => ({
    batch_id: batch.id,
    row_number: row.rowNumber,
    status: row.status,
    errors: row.errors.length ? row.errors : null,
    warnings: row.warnings.length ? row.warnings : null,
    raw_data: row.raw,
    mapped_data: row.mapped,
  }));

  if (rowRecords.length > 0) {
    const { error: rowsError } = await supabase.from("import_batch_rows").insert(rowRecords);
    if (rowsError) {
      throw new Error(rowsError.message);
    }
  }

  return batch;
}

export async function finalizeImportBatch(
  supabase: SupabaseClient,
  batchId: string,
  input: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    rowResults: Array<{
      rowNumber: number;
      status: string;
      entityType?: string;
      entityId?: string;
      error?: string;
    }>;
  },
) {
  const { error } = await supabase
    .from("import_batches")
    .update({
      status: input.failed > 0 && input.created + input.updated === 0 ? "failed" : "completed",
      created_rows: input.created,
      updated_rows: input.updated,
      skipped_rows: input.skipped,
      failed_rows: input.failed,
      completed_at: new Date().toISOString(),
      summary: input,
    })
    .eq("id", batchId);

  if (error) throw new Error(error.message);

  for (const row of input.rowResults) {
    await supabase
      .from("import_batch_rows")
      .update({
        status: row.status,
        created_entity_type: row.entityType ?? null,
        created_entity_id: row.entityId ?? null,
        errors: row.error ? [row.error] : null,
      })
      .eq("batch_id", batchId)
      .eq("row_number", row.rowNumber);
  }
}

export async function listImportBatches(supabase: SupabaseClient, limit = 20) {
  const { data, error } = await supabase
    .from("import_batches")
    .select("*, profiles:uploaded_by(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}
