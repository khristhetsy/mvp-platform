import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isFeatureEnabled } from "@/lib/feature-controls";
import { writeAuditLog } from "@/lib/data/audit";
import { buildStoragePath, createDocumentRecord, getStorageBucket } from "@/lib/data/documents";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { fillTermSheetDocx } from "@/lib/term-sheet/fill";
import { TERM_SHEET_FORMS } from "@/lib/term-sheet/fields";
import { gateTermSheetApi } from "@/lib/term-sheet/gate";
import { renderTermSheetPdf } from "@/lib/term-sheet/pdf";
import { missingRequired } from "@/lib/term-sheet/render";
import { getTermSheet, updateTermSheet } from "@/lib/term-sheet/store";

export const dynamic = "force-dynamic";
const DOC_TYPE = "TERM_SHEET";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Render the term sheet, save the PDF (and Word file) as TERM_SHEET documents, mark it finalized. */
export async function POST(request: Request): Promise<Response> {
  const g = await gateTermSheetApi();
  if ("error" in g) return g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFeatureEnabled(g.flags, "founder", "term_sheet_documents_upload")) {
    return NextResponse.json({ error: "Uploading term sheets to Documents is not available." }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; ackNotice?: boolean };
    if (typeof body.id !== "string") return NextResponse.json({ error: "Term sheet id is required." }, { status: 400 });
    if (body.ackNotice !== true) {
      return NextResponse.json({ error: "Please confirm the founder notice before you upload." }, { status: 400 });
    }
    const sheet = await getTermSheet(g.supabase, g.company.id, body.id);
    if (!sheet) return NextResponse.json({ error: "Term sheet not found." }, { status: 404 });

    const meta = TERM_SHEET_FORMS[sheet.formType];
    const emptyRequired = missingRequired(sheet.formType, sheet.values).map((f) => f.label);

    const admin = createServiceRoleClient();
    const baseName = `${g.company.company_name} — ${meta.label} term sheet`.replace(/[^a-zA-Z0-9._ -]/g, "");
    const bucket = getStorageBucket(DOC_TYPE);

    const files: Array<{ ext: "pdf" | "docx"; mime: string; buffer: Buffer }> = [
      { ext: "pdf", mime: "application/pdf", buffer: await renderTermSheetPdf(sheet.formType, sheet.values) },
    ];
    if (isFeatureEnabled(g.flags, "founder", "term_sheet_word_export")) {
      files.push({ ext: "docx", mime: DOCX_MIME, buffer: await fillTermSheetDocx(sheet.formType, sheet.values) });
    }

    let pdfDocumentId: string | null = null;
    for (const f of files) {
      const fileName = `${baseName}.${f.ext}`;
      const filePath = buildStoragePath(DOC_TYPE, g.company.id, g.profile.id, fileName);
      const up = await admin.storage.from(bucket).upload(filePath, f.buffer, { contentType: f.mime, upsert: false });
      if (up.error) throw new Error(up.error.message);

      // A newer finalized file of the same template archives the older one.
      await admin
        .from("documents")
        .update({ status: "archived" })
        .eq("company_id", g.company.id)
        .eq("document_type", DOC_TYPE)
        .eq("file_name", fileName)
        .neq("status", "archived");

      const { data: docRow, error: docErr } = await createDocumentRecord(admin, {
        company_id: g.company.id,
        uploaded_by: g.profile.id,
        document_type: DOC_TYPE,
        file_name: fileName,
        mime_type: f.mime,
        size_bytes: f.buffer.length,
        status: "uploaded",
        file_path: filePath,
        file_url: null,
        ai_summary: null,
      });
      if (docErr) throw new Error(docErr.message);
      if (f.ext === "pdf") pdfDocumentId = docRow?.id ?? null;
    }

    await updateTermSheet(g.supabase, g.company.id, sheet.id, g.profile.id, { status: "finalized", documentId: pdfDocumentId, noticeAcknowledged: true });
    await writeAuditLog(g.supabase, {
      userId: g.profile.id,
      action: "term_sheet_finalized",
      entityType: "term_sheet",
      entityId: sheet.id,
      metadata: { companyId: g.company.id, formType: sheet.formType, documentId: pdfDocumentId, emptyRequired: emptyRequired.length, noticeAcknowledged: true },
    });

    return NextResponse.json({ ok: true, documentId: pdfDocumentId, emptyRequired });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to upload the term sheet." }, { status: 500 });
  }
}
