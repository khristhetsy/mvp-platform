import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { countPdfPages, PdfValidationError } from "@/lib/esignature/pdf";
import {
  uploadToSignatureBucket,
  signatureSignedUrl,
  writeSignatureAudit,
  requestClientMeta,
} from "@/lib/esignature/storage";
import { createDraftRequest } from "@/lib/esignature/requests";
import {
  MAX_UPLOAD_BYTES,
  MIME_PDF,
  STORAGE_FOLDER_ORIGINALS,
  type SourceFormat,
} from "@/lib/esignature/types";

export const dynamic = "force-dynamic";
// Conversion can take a while; allow a generous budget.
export const maxDuration = 120;

/**
 * Admin upload: accept a .pdf or .docx, validate, convert .docx → PDF, store the
 * working PDF privately, and create a draft envelope. Returns the new request id
 * and a short-lived preview URL.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = await requirePermissionApi("review_documents");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  // Size guard (cheap, before reading the body into memory fully).
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File is too large. The limit is ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.` },
      { status: 400 },
    );
  }

  const mime = file.type || "";
  const name = file.name || "document";
  const isPdfByName = name.toLowerCase().endsWith(".pdf");

  // PDF-only for now. DOCX conversion stays wired behind convertDocxToPdf() but
  // is disabled here until a converter (CloudConvert) is configured.
  const sourceFormat: SourceFormat | null = mime === MIME_PDF || (isPdfByName && !mime) ? "pdf" : null;

  if (!sourceFormat) {
    return NextResponse.json(
      { error: "Only PDF files are accepted. If you have a Word document, save it as PDF first." },
      { status: 400 },
    );
  }

  const documentName = name.replace(/\.(pdf|docx)$/i, "");
  const dealLabel = typeof form?.get("deal_label") === "string" ? (form.get("deal_label") as string).trim() || null : null;
  const uploadBytes = Buffer.from(await file.arrayBuffer());

  const { supabase, userId, profile } = auth;
  const requestId = crypto.randomUUID();
  const meta = requestClientMeta(req);

  // PDF-only: the uploaded bytes are the canonical working PDF. (DOCX conversion
  // stays available behind convertDocxToPdf() for when a converter is enabled.)
  const workingPdf: Buffer = uploadBytes;
  const sourceFilePath: string | null = null;

  try {
    const pageCount = await countPdfPages(workingPdf);

    const workingFilePath = `${STORAGE_FOLDER_ORIGINALS}/${requestId}.pdf`;
    await uploadToSignatureBucket(supabase, workingFilePath, workingPdf, MIME_PDF);

    const request = await createDraftRequest(supabase, {
      documentName,
      dealLabel,
      sourceFormat,
      sourceFilePath,
      workingFilePath,
      pageCount,
      createdBy: userId,
    });

    await writeSignatureAudit(supabase, {
      requestId: request.id,
      eventType: "created",
      actor: profile.email ?? profile.full_name ?? userId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      metadata: { document_name: documentName, source_format: sourceFormat, page_count: pageCount },
    });

    await writeAuditLog(auth.supabase, {
      userId,
      action: "esignature.request_created",
      entityType: "signature_requests",
      entityId: request.id,
      metadata: { document_name: documentName, source_format: sourceFormat, deal_label: dealLabel },
    });

    const previewUrl = await signatureSignedUrl(supabase, workingFilePath, 600);

    return NextResponse.json({
      request: {
        id: request.id,
        document_name: request.document_name,
        deal_label: request.deal_label,
        source_format: request.source_format,
        page_count: request.page_count,
        status: request.status,
      },
      previewUrl,
    });
  } catch (err) {
    if (err instanceof PdfValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
