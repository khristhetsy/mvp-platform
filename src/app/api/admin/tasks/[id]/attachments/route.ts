import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { requireStaffApi } from "@/lib/api/admin";
import { track } from "@/lib/analytics/posthog";
import { getTaskRow, insertAttachment } from "@/lib/admin-tasks/queries";
import { logActivity } from "@/lib/admin-tasks/activity";
import { attachmentPath, originalPath, uploadTaskFile } from "@/lib/admin-tasks/storage";
import { converter, TaskConversionError } from "@/lib/admin-tasks/convert";
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES, type SourceFormat } from "@/lib/admin-tasks/types";

export const dynamic = "force-dynamic";

const CONVERT_DOCX = process.env.CONVERT_DOCX === "true";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: taskId } = await params;
    const task = await getTaskRow(auth.supabase, taskId);
    if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large (max 25 MB)." }, { status: 400 });
    }
    const sourceFormat: SourceFormat | undefined = ACCEPTED_MIME[file.type];
    if (!sourceFormat) {
      return NextResponse.json({ error: "Unsupported file type. Upload a PDF, DOCX, or PPTX." }, { status: 400 });
    }

    const attachmentId = randomUUID();
    const original = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || `file.${sourceFormat}`;

    let storagePath: string;
    let mimeType = file.type;
    let convertedToPdf = false;
    let originalStoragePath: string | null = null;
    let notice: string | null = null;

    const shouldConvert = sourceFormat === "pptx" || (sourceFormat === "docx" && CONVERT_DOCX);

    if (shouldConvert) {
      try {
        const pdf = await converter.toPdf({ bytes: original, sourceFormat, fileName: safeName });
        storagePath = attachmentPath(taskId, attachmentId, "pdf");
        await uploadTaskFile(auth.supabase, storagePath, pdf, "application/pdf");
        originalStoragePath = originalPath(taskId, attachmentId, sourceFormat);
        await uploadTaskFile(auth.supabase, originalStoragePath, original, file.type);
        mimeType = "application/pdf";
        convertedToPdf = true;
      } catch (convErr) {
        // Non-blocking: keep the original, surface a notice.
        Sentry.captureException(convErr, { extra: { taskId, attachmentId } });
        storagePath = attachmentPath(taskId, attachmentId, sourceFormat);
        await uploadTaskFile(auth.supabase, storagePath, original, file.type);
        notice = convErr instanceof TaskConversionError ? convErr.message : "Preview unavailable — original saved.";
      }
    } else {
      storagePath = attachmentPath(taskId, attachmentId, sourceFormat);
      await uploadTaskFile(auth.supabase, storagePath, original, file.type);
    }

    const attachment = await insertAttachment(auth.supabase, {
      id: attachmentId,
      task_id: taskId,
      storage_path: storagePath,
      file_name: safeName,
      mime_type: mimeType,
      size_bytes: file.size,
      source_format: sourceFormat,
      converted_to_pdf: convertedToPdf,
      original_storage_path: originalStoragePath,
      uploaded_by: auth.profile.id,
    });

    await logActivity(auth.supabase, taskId, auth.profile.id, "attachment_added", {
      payload: { file_name: safeName, source_format: sourceFormat, converted: convertedToPdf },
    });
    track("admin_task_attachment_uploaded", { userId: auth.profile.id, taskId, sourceFormat, converted: convertedToPdf });

    return NextResponse.json({ attachment, notice }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
