import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderInvestorCrmApi } from "@/lib/api/founder-crm";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const MAX_RAW_ROWS = 2000;
const MAX_CELL = 300;

const cell = z.string().max(MAX_CELL);

const importLogSchema = z.object({
  fileName: z.string().min(1).max(300),
  source: z.enum(["csv_import", "linkedin"]),
  columns: z.array(z.string().max(200)).max(200),
  mapping: z.array(z.string().max(40)).max(200),
  rows: z.array(z.array(cell).max(200)).max(MAX_RAW_ROWS),
  rowsTotal: z.number().int().min(0).max(100000),
  attention: z
    .array(z.object({ reason: z.string().max(60), cells: z.array(cell).max(200) }))
    .max(MAX_RAW_ROWS),
  counts: z.object({
    imported: z.number().int().min(0),
    updated: z.number().int().min(0),
    skipped: z.number().int().min(0),
    failed: z.number().int().min(0),
  }),
});

/**
 * Keeps a record of one upload: the file name, every column, how each column was
 * mapped, the original rows (capped), and the rows held back. The founder's own
 * contacts are saved by the import route; this only logs the upload for staff.
 */
export async function POST(request: Request) {
  const auth = await requireFounderInvestorCrmApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = importLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid import log." }, { status: 400 });
  }

  const d = parsed.data;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createServiceRoleClient() as any;
    const { error } = await admin.from("founder_import_uploads").insert({
      founder_id: auth.profile.id,
      company_id: auth.company.id,
      file_name: d.fileName,
      source: d.source,
      total_rows: d.rowsTotal,
      imported: d.counts.imported,
      updated: d.counts.updated,
      skipped: d.counts.skipped,
      failed: d.counts.failed,
      columns: d.columns,
      mapping: d.mapping,
      raw_rows: d.rows,
      attention_rows: d.attention,
      raw_truncated: d.rowsTotal > d.rows.length,
    });
    if (error) throw error;
  } catch {
    // The contacts are already saved; a failed log must never fail the import.
    return NextResponse.json({ error: "Could not log the upload." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
