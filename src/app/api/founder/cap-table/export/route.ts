import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { gateCapTableApi } from "@/lib/cap-table/gate";
import { getCapTable } from "@/lib/cap-table/store";
import { defaultHolders } from "@/lib/cap-table/compute";
import { renderCapTableWorkbook } from "@/lib/cap-table/workbook";
import { renderCapTablePdf } from "@/lib/cap-table/pdf";
import { getStorageBucket, buildStoragePath, createDocumentRecord } from "@/lib/data/documents";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import type { CapTable } from "@/lib/cap-table/types";

export const dynamic = "force-dynamic";

// Saved as CAP_TABLE — counts toward readiness AND satisfies the Qualify
// document requirement (Pitch deck, Financial statements, Cap table).
const DOC_TYPE = "CAP_TABLE";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Build the cap table as .xlsx or .pdf and save it as a CAP_TABLE document. */
export async function POST(req: Request): Promise<Response> {
  const g = await gateCapTableApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as { format?: string };
    const format = body.format === "pdf" ? "pdf" : "xlsx";

    const existing = await getCapTable(g.supabase, g.company.id);
    const cap: CapTable = {
      holders: existing && existing.holders.length > 0 ? existing.holders : defaultHolders(),
      round: existing?.round ?? null,
      updatedAt: existing?.updatedAt ?? null,
    };

    const isPdf = format === "pdf";
    const buffer = isPdf
      ? await renderCapTablePdf(g.company.company_name, cap)
      : await renderCapTableWorkbook(g.company.company_name, cap);
    const mime = isPdf ? "application/pdf" : XLSX_MIME;
    const ext = isPdf ? "pdf" : "xlsx";

    const admin = createServiceRoleClient();
    const fileName = `${g.company.company_name} — Cap table.${ext}`.replace(/[^a-zA-Z0-9._ -]/g, "");
    const bucket = getStorageBucket(DOC_TYPE);
    const filePath = buildStoragePath(DOC_TYPE, g.company.id, g.profile.id, fileName);

    const up = await admin.storage.from(bucket).upload(filePath, buffer, { contentType: mime, upsert: false });
    if (up.error) throw new Error(up.error.message);

    // Archive any prior active cap table so only the latest counts.
    await admin
      .from("documents")
      .update({ status: "archived" })
      .eq("company_id", g.company.id)
      .eq("document_type", DOC_TYPE)
      .eq("status", "uploaded");

    const { data: docRow, error: docErr } = await createDocumentRecord(admin, {
      company_id: g.company.id,
      uploaded_by: g.profile.id,
      document_type: DOC_TYPE,
      file_name: fileName,
      mime_type: mime,
      size_bytes: buffer.length,
      status: "uploaded",
      file_path: filePath,
      file_url: null,
      ai_summary: null,
    });
    if (docErr) throw new Error(docErr.message);

    const { data: signed } = await admin.storage.from(bucket).createSignedUrl(filePath, 60 * 10);

    await writeAuditLog(g.supabase, {
      userId: g.profile.id,
      action: "cap_table_exported",
      entityType: "company",
      entityId: g.company.id,
      metadata: { documentId: docRow?.id ?? null, format },
    });

    return NextResponse.json({ ok: true, documentId: docRow?.id ?? null, fileName, url: signed?.signedUrl ?? null });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to export the cap table." }, { status: 500 });
  }
}
